import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/cached_exam.dart';
import '../services/database_helper.dart';
import '../api_constants.dart';
import 'exam_review_screen.dart';

class _JoinedExam {
  final List<Map<String, dynamic>> questions;
  final int durationMinutes;

  const _JoinedExam({required this.questions, required this.durationMinutes});
}

/// Fetches the question set and server-configured timer for the scanned session.
Future<_JoinedExam> _fetchExam(String sessionId) async {
  final uri = ApiConstants.endpoint(
    'api/student/papers/join/${Uri.encodeComponent(sessionId)}',
  );

  try {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');

    final response = await http
        .get(
          uri,
          headers: {
            'Accept': 'application/json',
            if (token != null && token.isNotEmpty)
              'Authorization': 'Bearer $token',
          },
        )
        .timeout(const Duration(seconds: 8));

    if (response.statusCode == 401) {
      throw Exception('Unauthorized');
    }

    if (response.statusCode != 200) {
      throw Exception('Failed to load questions (${response.statusCode})');
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('Backend response was not a JSON object.');
    }

    final durationMinutes = int.tryParse('${decoded['durationMinutes']}') ?? 30;
    final rawQuestions = decoded['questionsJson'];
    if (rawQuestions == null ||
        rawQuestions.toString().trim().isEmpty ||
        rawQuestions == 'null' ||
        rawQuestions == '[]') {
      return _JoinedExam(
        questions: const [],
        durationMinutes: durationMinutes > 0 ? durationMinutes : 30,
      );
    }

    // questionsJson may already be a List (if serialized inline) or a JSON string
    final dynamic parsed = rawQuestions is String
        ? jsonDecode(rawQuestions)
        : rawQuestions;

    if (parsed is! List) {
      print(
        '❌ JSON Error: parsed questionsJson is not a List. Type is ${parsed.runtimeType}',
      );
      return _JoinedExam(
        questions: const [],
        durationMinutes: durationMinutes > 0 ? durationMinutes : 30,
      );
    }

    return _JoinedExam(
      questions: parsed
          .whereType<Map>()
          .map((question) => Map<String, dynamic>.from(question))
          .toList(),
      durationMinutes: durationMinutes > 0 ? durationMinutes : 30,
    );
  } on TimeoutException {
    print('❌ API Error: Connection timed out.');
    throw Exception('Connection failed. Check your internet connection.');
  } on FormatException catch (e, stack) {
    print('❌ JSON FormatException: ${e.message}\n$stack');
    throw Exception('Connection failed. Check your internet connection.');
  } catch (e, stack) {
    print('❌ API Catch-all Error: $e\n$stack');
    if (e is Exception && e.toString().contains('Connection failed')) {
      rethrow;
    }
    if (e is Exception && e.toString().contains('Unauthorized')) {
      throw Exception('Unauthorized');
    }
    throw Exception('Connection failed. Check your internet connection.');
  }
}

class _Question {
  final int id;
  final String text;
  final List<String> options;
  final int correctIndex;

  const _Question({
    required this.id,
    required this.text,
    required this.options,
    required this.correctIndex,
  });
}

/// ExamTimerScreen — UC2.2 (timer lock) + UC2.5 (offline save).
///
/// Shows a countdown timer, renders MCQ questions for A/L ICT, and saves
/// progress locally via SQLite on every answer change and on submit.
class ExamTimerScreen extends StatefulWidget {
  /// QR payload decoded from [QRScannerScreen], used as the session ID.
  final String qrPayload;

  const ExamTimerScreen({super.key, required this.qrPayload});

  @override
  State<ExamTimerScreen> createState() => _ExamTimerScreenState();
}

class _ExamTimerScreenState extends State<ExamTimerScreen>
    with WidgetsBindingObserver {
  // ── Timer state ─────────────────────────────────────────────────────
  int _configuredDurationMinutes = 30;
  int _remainingSeconds = 30 * 60;
  Timer? _countdownTimer;
  Timer? _serverSyncTimer;
  bool _syncingTimer = false;
  bool _submitted = false;

  // ── Loaded question state ─────────────────────────────────────────────
  final List<_Question> _questions = [];
  bool _isLoadingQuestions = true;
  String _questionsError = '';

  // ── Answer state ─────────────────────────────────────────────────────
  /// Map of questionId → selected option index (or -1 for unanswered)
  final Map<int, int> _answers = {};

  // ── DB state ─────────────────────────────────────────────────────────
  bool _dbSaving = false;
  String _saveStatus = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadQuestions();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _countdownTimer?.cancel();
    _serverSyncTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Auto-save progress when app is backgrounded (UC2.5)
    if (state == AppLifecycleState.paused && !_submitted) {
      _saveProgressLocally(status: 'in_progress');
    } else if (state == AppLifecycleState.resumed && !_submitted) {
      _syncServerTimer();
    }
  }

  // ── Init helpers ────────────────────────────────────────────────────

  void _initAnswers() {
    _answers.clear();
    for (final q in _questions) {
      _answers[q.id] = -1; // -1 = unanswered
    }
  }

  // Helper to find a value ignoring case
  dynamic _getValueIgnoreCase(Map<String, dynamic> map, List<String> keys) {
    for (final key in keys) {
      if (map.containsKey(key)) return map[key];
      final lowerKey = key.toLowerCase();
      for (final entry in map.entries) {
        if (entry.key.toLowerCase() == lowerKey) return entry.value;
      }
    }
    return null;
  }

  Future<void> _loadQuestions() async {
    try {
      final joinedExam = await _fetchExam(widget.qrPayload);
      final rawQuestions = joinedExam.questions;

      int fallbackIdCounter = 1;

      final loadedQuestions = rawQuestions
          .map((entry) {
            // Find question ID
            final rawId = _getValueIgnoreCase(entry, [
              'questionNo',
              'id',
              'questionId',
            ]);
            int id = int.tryParse('$rawId') ?? 0;
            if (id == 0) {
              id = fallbackIdCounter++;
            }

            // Find question text
            final rawText = _getValueIgnoreCase(entry, [
              'questionText',
              'text',
              'question',
            ]);
            final text = (rawText ?? 'Untitled question').toString();

            // Find options
            final rawOptions = _getValueIgnoreCase(entry, ['options']);
            final options = (rawOptions as List? ?? const [])
                .map((option) => option.toString())
                .toList();

            // Find correct option index
            final rawCorrect = _getValueIgnoreCase(entry, [
              'correctOptionIndex',
              'correctOption',
              'correctIndex',
              'answerIndex',
              'answer',
            ]);

            // Handle 1-based or 0-based index properly depending on data
            int correctIdx = int.tryParse('$rawCorrect') ?? 0;

            return _Question(
              id: id,
              text: text,
              options: options,
              correctIndex: correctIdx,
            );
          })
          .where((question) {
            // We only require text to not be empty now, since questionNo might be 0 or missing in some rogue JSONs.
            if (question.text.isEmpty) {
              print('⚠️ Warning: Dropped question because text was empty.');
              return false;
            }
            return true;
          })
          .toList();

      if (!mounted) return;

      await _startExamTimer(joinedExam.durationMinutes);
      if (!mounted) return;

      setState(() {
        _questions
          ..clear()
          ..addAll(loadedQuestions);
        _isLoadingQuestions = false;
        _questionsError = '';
      });

      _initAnswers();
      await _cacheExamLocally();
    } catch (e) {
      if (!mounted) return;

      final message = e.toString().contains('Unauthorized')
          ? 'Session unauthorized. Please log in again.'
          : e.toString().contains('Connection failed')
          ? 'Connection failed. Check your internet connection.'
          : 'Unable to load questions right now. Please try again.';

      setState(() {
        _questions.clear();
        _isLoadingQuestions = false;
        _questionsError = message;
      });
    }
  }

  Future<void> _cacheExamLocally() async {
    final exam = CachedExam(
      sessionId: widget.qrPayload,
      subject: 'A/L ICT',
      durationMinutes: _configuredDurationMinutes,
      questionsJson: jsonEncode(
        _questions
            .map((q) => {'id': q.id, 'text': q.text, 'options': q.options})
            .toList(),
      ),
      answersJson: '{}',
      status: 'in_progress',
      totalScore: 0,
      createdAt: DateTime.now().toIso8601String(),
    );
    await DatabaseHelper.instance.upsertExam(exam);
  }

  // ── Timer logic ─────────────────────────────────────────────────────

  Future<void> _startExamTimer(int durationMinutes) async {
    final uri = ApiConstants.endpoint(
      'api/student/papers/start/${Uri.encodeComponent(widget.qrPayload)}',
    );
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    final response = await http
        .post(
          uri,
          headers: {
            'Accept': 'application/json',
            if (token != null && token.isNotEmpty)
              'Authorization': 'Bearer $token',
          },
        )
        .timeout(const Duration(seconds: 8));

    if (response.statusCode != 200) {
      throw Exception('Unable to start exam timer (${response.statusCode}).');
    }

    final data = jsonDecode(response.body);
    if (data is! Map<String, dynamic>) {
      throw const FormatException('Timer response was not a JSON object.');
    }

    final serverDuration =
        int.tryParse('${data['durationMinutes']}') ?? durationMinutes;
    final remainingSeconds =
        int.tryParse('${data['remainingSeconds']}') ?? serverDuration * 60;

    if (!mounted) return;
    setState(() {
      _configuredDurationMinutes = serverDuration > 0
          ? serverDuration
          : durationMinutes;
      _remainingSeconds = remainingSeconds.clamp(0, 600 * 60).toInt();
    });
    _startTimer();
    _serverSyncTimer?.cancel();
    _serverSyncTimer = Timer.periodic(
      const Duration(seconds: 10),
      (_) => _syncServerTimer(),
    );
  }

  Future<void> _syncServerTimer() async {
    if (_syncingTimer || _submitted || !mounted) return;
    _syncingTimer = true;
    try {
      final uri = ApiConstants.endpoint(
        'api/student/papers/timer/${Uri.encodeComponent(widget.qrPayload)}',
      );
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      final response = await http
          .get(
            uri,
            headers: {
              'Accept': 'application/json',
              if (token != null && token.isNotEmpty)
                'Authorization': 'Bearer $token',
            },
          )
          .timeout(const Duration(seconds: 8));

      if (response.statusCode != 200) {
        throw Exception('Timer sync failed (${response.statusCode}).');
      }

      final data = jsonDecode(response.body);
      if (data is! Map<String, dynamic>) {
        throw const FormatException('Timer response was not a JSON object.');
      }

      final serverDuration =
          int.tryParse('${data['durationMinutes']}') ??
          _configuredDurationMinutes;
      final remainingSeconds =
          int.tryParse('${data['remainingSeconds']}') ?? _remainingSeconds;
      if (!mounted) return;

      setState(() {
        _configuredDurationMinutes = serverDuration > 0
            ? serverDuration
            : _configuredDurationMinutes;
        _remainingSeconds = remainingSeconds.clamp(0, 600 * 60).toInt();
      });

      if (remainingSeconds <= 0) {
        _autoSubmit();
      }
    } catch (error) {
      debugPrint('Unable to synchronize exam timer: $error');
    } finally {
      _syncingTimer = false;
    }
  }

  void _startTimer() {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_remainingSeconds <= 0) {
        timer.cancel();
        _autoSubmit();
        return;
      }
      if (mounted) {
        setState(() => _remainingSeconds--);
      }
    });
  }

  /// Auto-submit when time runs out.
  void _autoSubmit() {
    if (_submitted) return;
    _handleSubmit(autoSubmit: true);
  }

  // ── Answer handling ─────────────────────────────────────────────────

  void _selectAnswer(int questionId, int optionIndex) {
    if (_submitted) return;
    setState(() => _answers[questionId] = optionIndex);
    // Debounced background save
    _saveProgressLocally(status: 'in_progress');
  }

  String _encodeAnswers() =>
      jsonEncode(_answers.map((key, value) => MapEntry(key.toString(), value)));

  // ── SQLite persistence ───────────────────────────────────────────────

  Future<void> _saveProgressLocally({required String status}) async {
    if (_dbSaving) return;
    setState(() => _dbSaving = true);
    try {
      await DatabaseHelper.instance.saveProgress(
        sessionId: widget.qrPayload,
        answersJson: _encodeAnswers(),
        status: status,
        totalScore: _calculateScore(),
      );
      if (mounted) setState(() => _saveStatus = 'Saved locally ✓');
    } catch (e) {
      debugPrint('[ExamTimerScreen] Local progress save failed: $e');
      if (mounted) setState(() => _saveStatus = 'Save failed — will retry');
    } finally {
      if (mounted) setState(() => _dbSaving = false);
    }
  }

  Future<void> _submitToDb() async {
    final updatedRows = await DatabaseHelper.instance.markSubmitted(
      sessionId: widget.qrPayload,
      answersJson: _encodeAnswers(),
      totalScore: _calculateScore(),
    );
    if (updatedRows == 0) {
      await _cacheExamLocally();
      final retriedRows = await DatabaseHelper.instance.markSubmitted(
        sessionId: widget.qrPayload,
        answersJson: _encodeAnswers(),
        totalScore: _calculateScore(),
      );
      if (retriedRows == 0) {
        throw StateError('Submitted exam was not found in the local cache.');
      }
    }
  }

  int _calculateScore() {
    int score = 0;
    for (final q in _questions) {
      if (_answers[q.id] == q.correctIndex) score++;
    }
    return score;
  }

  /// Submits the final score to the backend (POST /api/student/submit).
  /// This is best-effort: a network failure never blocks the results screen.
  Future<void> _submitToBackend() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');

      final uri = ApiConstants.endpoint('api/student/submit');
      final answersJson = _encodeAnswers();

      final payload = {
        'sessionGuid': widget.qrPayload,
        'answersJson': answersJson,
        'totalScore': _calculateScore(),
      };

      final body = jsonEncode(payload);

      print(
        '[ExamTimerScreen] → POST /api/student/submit | payload keys: ${payload.keys.toList()} | score=${payload['totalScore']}',
      );

      final response = await http
          .post(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              if (token != null && token.isNotEmpty)
                'Authorization': 'Bearer $token',
            },
            body: body,
          )
          .timeout(const Duration(seconds: 15));

      print(
        '[ExamTimerScreen] ← Backend submit response: HTTP ${response.statusCode} | body: ${response.body}',
      );

      if (response.statusCode < 200 || response.statusCode >= 300) {
        if (mounted) {
          setState(
            () => _saveStatus = 'Server save failed — retry when online',
          );
        }
        return;
      }

      if (mounted) setState(() => _saveStatus = 'Exam synced to server ✓');
    } catch (e, stack) {
      debugPrint('[ExamTimerScreen] Backend submit failed (non-fatal): $e');
      debugPrint('[ExamTimerScreen] Stack: $stack');
      if (mounted) {
        setState(() => _saveStatus = 'Server unavailable — retry when online');
      }
    }
  }

  // ── Submit flow ─────────────────────────────────────────────────────

  Future<void> _handleSubmit({bool autoSubmit = false}) async {
    if (_submitted) return;

    if (!autoSubmit) {
      final confirmed = await _showConfirmDialog();
      if (!confirmed) return;
    }

    _countdownTimer?.cancel();
    setState(() => _submitted = true);

    // 1. Persist locally (offline-first, UC2.5), but still sync if local storage fails.
    try {
      await _submitToDb();
    } catch (e, stack) {
      debugPrint('[ExamTimerScreen] Local submit save failed: $e');
      debugPrint('[ExamTimerScreen] Stack: $stack');
      if (mounted)
        setState(() => _saveStatus = 'Local save failed — syncing to server');
    }

    // 2. Sync to backend (best-effort — does not block the UI)
    unawaited(_submitToBackend());

    _showResultsSheet();
  }

  Future<bool> _showConfirmDialog() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Submit Exam?',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        content: Text(
          'You have answered '
          '${_answers.values.where((v) => v >= 0).length} of '
          '${_questions.length} questions. '
          'This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.orange),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Submit'),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  void _showResultsSheet() {
    final score = _calculateScore();
    final total = _questions.length;
    final pct = total == 0 ? 0 : (score / total * 100).round();

    showModalBottomSheet<void>(
      context: context,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: Colors.transparent,
      builder: (_) => _ResultsSheet(
        score: score,
        total: total,
        percentage: pct,
        sessionId: widget.qrPayload,
        onViewResults: () {
          // Close sheet
          Navigator.pop(context);
          // Navigate directly to Review screen
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (ctx) => ExamReviewScreen(
                sessionId: widget.qrPayload,
                subject: 'A/L ICT',
                title: 'Mock Exam',
                score: score,
                totalQuestions: total,
                date: DateTime.now().toIso8601String(),
                questionsJson: jsonEncode(
                  _questions
                      .map(
                        (q) => {
                          'id': q.id,
                          'text': q.text,
                          'options': q.options,
                          'correctOptionIndex': q.correctIndex,
                        },
                      )
                      .toList(),
                ),
                answersJson: _encodeAnswers(),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Timer display ────────────────────────────────────────────────────

  String get _timerLabel {
    final m = _remainingSeconds ~/ 60;
    final s = _remainingSeconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  Color get _timerColor {
    if (_remainingSeconds <= 300) return Colors.red;
    if (_remainingSeconds <= 600) return Colors.orange;
    return Colors.orange.shade700;
  }

  int get _answeredCount => _answers.values.where((v) => v >= 0).length;

  // ── Build ────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: _buildAppBar(),
      body: _isLoadingQuestions
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: Colors.orange),
                  SizedBox(height: 16),
                  Text(
                    'Loading questions...',
                    style: TextStyle(
                      fontSize: 15,
                      color: Colors.grey,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            )
          : _questions.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _questionsError.isNotEmpty
                      ? _questionsError
                      : 'No questions are available for this session.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 16, color: Colors.grey),
                ),
              ),
            )
          : Column(
              children: [
                _buildTimerBanner(),
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                    itemCount: _questions.length,
                    itemBuilder: (_, i) => _QuestionCard(
                      question: _questions[i],
                      selectedIndex: _answers[_questions[i].id] ?? -1,
                      isSubmitted: _submitted,
                      onSelected: _submitted
                          ? null
                          : (idx) => _selectAnswer(_questions[i].id, idx),
                    ),
                  ),
                ),
              ],
            ),
      bottomNavigationBar: _isLoadingQuestions || _questions.isEmpty
          ? null
          : _buildBottomBar(),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: Colors.orange,
      foregroundColor: Colors.white,
      elevation: 0,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'A/L ICT Mock Exam',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          Text(
            'Session: ${widget.qrPayload.length > 16 ? widget.qrPayload.substring(0, 16) : widget.qrPayload}…',
            style: const TextStyle(fontSize: 9, color: Colors.white70),
          ),
        ],
      ),
      actions: [
        if (_dbSaving)
          const Padding(
            padding: EdgeInsets.only(right: 8),
            child: Center(
              child: SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2,
                ),
              ),
            ),
          )
        else if (_saveStatus.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Text(
                _saveStatus,
                style: const TextStyle(fontSize: 10, color: Colors.white70),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildTimerBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
      ),
      child: Row(
        children: [
          // Countdown clock
          Icon(Icons.timer_outlined, color: _timerColor, size: 20),
          const SizedBox(width: 8),
          Text(
            _timerLabel,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: _timerColor,
              fontFamily: 'monospace',
            ),
          ),
          const SizedBox(width: 4),
          Text(
            _remainingSeconds <= 300 ? ' — Time running out!' : ' remaining',
            style: TextStyle(fontSize: 11, color: _timerColor.withAlpha(180)),
          ),
          const Spacer(),
          // Progress chip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.orange.withAlpha(20),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.orange.withAlpha(60)),
            ),
            child: Text(
              '$_answeredCount / ${_questions.length}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: Colors.orange,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        MediaQuery.of(context).padding.bottom + 12,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(15),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Progress indicator
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: _questions.isEmpty
                  ? 0
                  : _answeredCount / _questions.length,
              backgroundColor: Colors.grey.shade200,
              valueColor: const AlwaysStoppedAnimation<Color>(Colors.orange),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 12),
          // Submit button
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: _submitted ? Colors.grey : Colors.orange,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              onPressed: _submitted ? null : () => _handleSubmit(),
              icon: Icon(
                _submitted ? Icons.check_circle : Icons.send_rounded,
                size: 18,
              ),
              label: Text(
                _submitted
                    ? 'Exam Submitted'
                    : 'Submit Answers ($_answeredCount/${_questions.length})',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Question card widget ───────────────────────────────────────────────────

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.question,
    required this.selectedIndex,
    required this.isSubmitted,
    required this.onSelected,
  });

  final _Question question;
  final int selectedIndex;
  final bool isSubmitted;
  final void Function(int)? onSelected;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Question number badge + text
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: Colors.orange,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(
                    child: Text(
                      '${question.id}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    question.text,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1A1A1A),
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            // Options
            ...List.generate(question.options.length, (i) {
              return _OptionTile(
                label: String.fromCharCode(65 + i), // A, B, C, D
                text: question.options[i],
                isSelected: selectedIndex == i,
                isCorrect: isSubmitted && question.correctIndex == i,
                isWrong:
                    isSubmitted &&
                    selectedIndex == i &&
                    question.correctIndex != i,
                onTap: onSelected == null ? null : () => onSelected!(i),
              );
            }),
          ],
        ),
      ),
    );
  }
}

// ── Option tile ────────────────────────────────────────────────────────────

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.label,
    required this.text,
    required this.isSelected,
    required this.isCorrect,
    required this.isWrong,
    required this.onTap,
  });

  final String label;
  final String text;
  final bool isSelected;
  final bool isCorrect;
  final bool isWrong;
  final VoidCallback? onTap;

  Color get _borderColor {
    if (isCorrect) return Colors.green;
    if (isWrong) return Colors.red;
    if (isSelected) return Colors.orange;
    return Colors.grey.shade300;
  }

  Color get _bgColor {
    if (isCorrect) return Colors.green.shade50;
    if (isWrong) return Colors.red.shade50;
    if (isSelected) return Colors.orange.shade50;
    return Colors.transparent;
  }

  Color get _labelBg {
    if (isCorrect) return Colors.green;
    if (isWrong) return Colors.red;
    if (isSelected) return Colors.orange;
    return Colors.grey.shade300;
  }

  Color get _labelFg {
    if (isSelected || isCorrect || isWrong) return Colors.white;
    return Colors.grey.shade600;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: _bgColor,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: _borderColor, width: 1.5),
        ),
        child: Row(
          children: [
            // Label bubble
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: _labelBg,
                borderRadius: BorderRadius.circular(7),
              ),
              child: Center(
                child: Text(
                  label,
                  style: TextStyle(
                    color: _labelFg,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                text,
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey.shade800,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ),
            if (isCorrect)
              const Icon(Icons.check_circle, color: Colors.green, size: 18)
            else if (isWrong)
              const Icon(Icons.cancel, color: Colors.red, size: 18),
          ],
        ),
      ),
    );
  }
}

// ── Results bottom sheet ───────────────────────────────────────────────────

class _ResultsSheet extends StatelessWidget {
  const _ResultsSheet({
    required this.score,
    required this.total,
    required this.percentage,
    required this.sessionId,
    required this.onViewResults,
  });

  final int score;
  final int total;
  final int percentage;
  final String sessionId;
  final VoidCallback onViewResults;

  Color get _gradeColor {
    if (percentage >= 75) return Colors.green;
    if (percentage >= 50) return Colors.orange;
    return Colors.red;
  }

  String get _grade {
    if (percentage >= 75) return 'A';
    if (percentage >= 65) return 'B';
    if (percentage >= 55) return 'C';
    if (percentage >= 35) return 'S';
    return 'F';
  }

  String get _feedback {
    if (percentage >= 75) return 'Excellent work! Keep it up.';
    if (percentage >= 50) return 'Good effort. Review weak areas.';
    return 'Needs more practice. Review your notes.';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        24,
        24,
        24,
        MediaQuery.of(context).padding.bottom + 24,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle bar
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Score circle
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: _gradeColor, width: 4),
              color: _gradeColor.withAlpha(20),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  _grade,
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: _gradeColor,
                  ),
                ),
                Text(
                  '$percentage%',
                  style: TextStyle(fontSize: 12, color: _gradeColor),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Exam Complete!',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.grey.shade900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$score out of $total correct',
            style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 8),
          Text(
            _feedback,
            style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          // Saved locally badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.green.shade200),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.storage_rounded,
                  color: Colors.green.shade600,
                  size: 14,
                ),
                const SizedBox(width: 6),
                Text(
                  'Results saved offline (UC2.5)',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.green.shade700,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: Colors.orange,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              onPressed: onViewResults,
              icon: const Icon(Icons.analytics_rounded, size: 20),
              label: const Text(
                '🎯 View My Results',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
