import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/cached_exam.dart';
import '../services/database_helper.dart';
import '../api_constants.dart';
import 'exam_review_screen.dart';
import '../ui/prep_ui.dart';

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
      debugPrint(
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
    debugPrint('❌ API Error: Connection timed out.');
    throw Exception('Connection failed. Check your internet connection.');
  } on FormatException catch (e, stack) {
    debugPrint('❌ JSON FormatException: ${e.message}\n$stack');
    throw Exception('Connection failed. Check your internet connection.');
  } catch (e, stack) {
    debugPrint('❌ API Catch-all Error: $e\n$stack');
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
  int _currentQuestionIndex = 0;

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
              debugPrint('⚠️ Warning: Dropped question because text was empty.');
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
      try {
        await _cacheExamLocally();
      } catch (error) {
        debugPrint('[ExamTimerScreen] Initial local cache failed: $error');
        if (mounted) {
          setState(
            () => _saveStatus = 'Local save unavailable — syncing online',
          );
        }
      }
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

      debugPrint('[ExamTimerScreen] Submitting exam result.');

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

      debugPrint(
        '[ExamTimerScreen] Exam submission response: HTTP ${response.statusCode}.',
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
      if (mounted) {
        setState(() => _saveStatus = 'Local save failed — syncing to server');
      }
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
            style: FilledButton.styleFrom(backgroundColor: PrepColors.primary),
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
      isScrollControlled: true,
      isDismissible: false,
      enableDrag: false,
      backgroundColor: Colors.white,
      showDragHandle: true,
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
    if (_remainingSeconds <= 300) return PrepColors.error;
    if (_remainingSeconds <= 600) return PrepColors.amber;
    return PrepColors.primary;
  }

  int get _answeredCount => _answers.values.where((v) => v >= 0).length;

  // ── Build ────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: _buildAppBar(),
    body: SafeArea(
      top: false,
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (_isLoadingQuestions) {
            return const PrepPage(
              child: PrepState(
                title: 'Preparing your exam',
                message: 'Loading questions and synchronizing your timer.',
                loading: true,
              ),
            );
          }
          if (_questions.isEmpty) {
            return PrepPage(
              child: PrepState(
                title: 'Exam unavailable',
                message: _questionsError.isNotEmpty
                    ? _questionsError
                    : 'No questions are available for this session.',
                icon: Icons.assignment_late_outlined,
                action: 'Back to scanner',
                onAction: () => Navigator.of(context).pop(),
              ),
            );
          }
          final compact =
              constraints.maxHeight < 480 ||
              MediaQuery.textScalerOf(context).scale(16) > 24;
          return Column(
            children: [
              if (!compact) _buildTimerBanner(),
              Expanded(
                child: SingleChildScrollView(
                  key: ValueKey(_currentQuestionIndex),
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 760),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (compact) ...[
                            _buildTimerBanner(),
                            const SizedBox(height: 16),
                          ],
                          Wrap(
                            alignment: WrapAlignment.spaceBetween,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            spacing: 12,
                            children: [
                              Text(
                                'Question ${_currentQuestionIndex + 1} of ${_questions.length}',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              TextButton.icon(
                                onPressed: _showQuestionNavigator,
                                icon: const Icon(
                                  Icons.grid_view_rounded,
                                  size: 18,
                                ),
                                label: const Text('All questions'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          _QuestionCard(
                            question: _questions[_currentQuestionIndex],
                            selectedIndex:
                                _answers[_questions[_currentQuestionIndex]
                                    .id] ??
                                -1,
                            isSubmitted: _submitted,
                            onSelected: _submitted
                                ? null
                                : (idx) => _selectAnswer(
                                    _questions[_currentQuestionIndex].id,
                                    idx,
                                  ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Select one answer. You can revisit questions before submitting.',
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    ),
    bottomNavigationBar: _isLoadingQuestions || _questions.isEmpty
        ? null
        : _buildBottomBar(),
  );

  void _showQuestionNavigator() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.75,
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Your questions',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Check marks show answered questions. Tap a number to revisit it.',
                ),
                const SizedBox(height: 20),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: List.generate(_questions.length, (i) {
                    final answered = (_answers[_questions[i].id] ?? -1) >= 0;
                    return Semantics(
                      label:
                          'Question ${i + 1}, ${answered ? 'answered' : 'unanswered'}',
                      selected: i == _currentQuestionIndex,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          backgroundColor: i == _currentQuestionIndex
                              ? PrepColors.mint
                              : null,
                        ),
                        onPressed: () {
                          setState(() => _currentQuestionIndex = i);
                          Navigator.pop(sheetContext);
                        },
                        child: Text('${i + 1}${answered ? ' ✓' : ''}'),
                      ),
                    );
                  }),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() => AppBar(
    title: Text(
      _submitted ? 'Exam submitted' : 'A/L ICT exam',
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    ),
    actions: [
      if (_dbSaving)
        const Padding(
          padding: EdgeInsets.all(18),
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              semanticsLabel: 'Saving progress',
            ),
          ),
        ),
    ],
  );

  Widget _buildTimerBanner() => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
    decoration: const BoxDecoration(
      color: Colors.white,
      border: Border(bottom: BorderSide(color: PrepColors.line)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 16,
          runSpacing: 8,
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Semantics(
              label: 'Time remaining $_timerLabel',
              child: ExcludeSemantics(
                child: Text(
                  _timerLabel,
                  style: TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.w800,
                    color: _timerColor,
                  ),
                ),
              ),
            ),
            PrepPill(
              '$_answeredCount / ${_questions.length} answered',
              icon: Icons.task_alt_rounded,
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          _remainingSeconds <= 300
              ? 'Time is running out. Check your answers.'
              : 'Time remaining',
          style: TextStyle(color: _timerColor, fontSize: 13),
        ),
        const SizedBox(height: 12),
        LinearProgressIndicator(
          value: _questions.isEmpty ? 0 : _answeredCount / _questions.length,
          minHeight: 5,
          backgroundColor: PrepColors.line,
          borderRadius: BorderRadius.circular(4),
          semanticsLabel: 'Questions answered',
          semanticsValue: _questions.isEmpty
              ? '0'
              : '${(_answeredCount / _questions.length * 100).round()}',
        ),
        if (_saveStatus.isNotEmpty) ...[
          const SizedBox(height: 10),
          Semantics(
            liveRegion: true,
            child: Text(
              _saveStatus,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ],
    ),
  );

  Widget _buildBottomBar() => SafeArea(
    top: false,
    child: Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      color: Colors.white,
      child: Row(
        children: [
          IconButton.outlined(
            tooltip: 'Previous question',
            onPressed: _currentQuestionIndex > 0
                ? () => setState(() => _currentQuestionIndex--)
                : null,
            icon: const Icon(Icons.arrow_back_rounded),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton(
              onPressed: _submitted ? null : () => _handleSubmit(),
              child: Text(_submitted ? 'Submitted' : 'Submit answers'),
            ),
          ),
          const SizedBox(width: 12),
          IconButton.outlined(
            tooltip: 'Next question',
            onPressed: _currentQuestionIndex < _questions.length - 1
                ? () => setState(() => _currentQuestionIndex++)
                : null,
            icon: const Icon(Icons.arrow_forward_rounded),
          ),
        ],
      ),
    ),
  );
}

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
  final ValueChanged<int>? onSelected;
  @override
  Widget build(BuildContext context) => PrepCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(question.text, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 24),
        ...List.generate(
          question.options.length,
          (i) => _OptionTile(
            label: String.fromCharCode(65 + i),
            text: question.options[i],
            isSelected: selectedIndex == i,
            isCorrect: isSubmitted && question.correctIndex == i,
            isWrong:
                isSubmitted && selectedIndex == i && question.correctIndex != i,
            onTap: onSelected == null ? null : () => onSelected!(i),
          ),
        ),
      ],
    ),
  );
}

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
  @override
  Widget build(BuildContext context) {
    final accent = isWrong ? PrepColors.error : PrepColors.primary;
    final active = isSelected || isCorrect || isWrong;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Semantics(
        selected: isSelected,
        inMutuallyExclusiveGroup: true,
        button: true,
        enabled: onTap != null,
        label: isCorrect
            ? 'Correct answer'
            : isWrong
            ? 'Incorrect answer'
            : null,
        child: Material(
          color: active ? accent.withAlpha(16) : Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(
              color: active ? accent : PrepColors.line,
              width: active ? 2 : 1,
            ),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    constraints: const BoxConstraints(
                      minWidth: 32,
                      minHeight: 32,
                    ),
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: active ? accent : PrepColors.canvas,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      label,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: active ? Colors.white : PrepColors.muted,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      text,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        fontWeight: isSelected
                            ? FontWeight.w600
                            : FontWeight.w400,
                      ),
                    ),
                  ),
                  if (active) ...[
                    const SizedBox(width: 8),
                    Icon(
                      isWrong
                          ? Icons.cancel_outlined
                          : Icons.check_circle_rounded,
                      color: accent,
                      size: 22,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

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
    if (percentage >= 75) return PrepColors.primary;
    if (percentage >= 50) return PrepColors.amber;
    return PrepColors.error;
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
  Widget build(BuildContext context) => SafeArea(
    child: ConstrainedBox(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: _gradeColor.withAlpha(16),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Text(
                  _grade,
                  style: TextStyle(
                    fontSize: 52,
                    fontWeight: FontWeight.w800,
                    color: _gradeColor,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Exam complete',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 8),
            Text(_feedback, textAlign: TextAlign.center),
            const SizedBox(height: 24),
            PrepMetrics(
              items: [
                PrepMetric(
                  label: 'Correct answers',
                  value: '$score / $total',
                  icon: Icons.task_alt_rounded,
                ),
                PrepMetric(
                  label: 'Your score',
                  value: '$percentage%',
                  icon: Icons.insights_rounded,
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Text(
              'Review your answers to see what to practise next.',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onViewResults,
              icon: const Icon(Icons.fact_check_outlined),
              label: const Text('Review my answers'),
            ),
          ],
        ),
      ),
    ),
  );
}
