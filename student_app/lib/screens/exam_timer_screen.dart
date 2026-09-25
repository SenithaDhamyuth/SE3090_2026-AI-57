import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/cached_exam.dart';
import '../services/database_helper.dart';

// ── Static demo questions (A/L ICT domain) ────────────────────────────────

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

const List<_Question> _kQuestions = [
  _Question(
    id: 1,
    text:
        'Which data structure uses the LIFO (Last-In, First-Out) principle?',
    options: ['Queue', 'Stack', 'Linked List', 'Tree'],
    correctIndex: 1,
  ),
  _Question(
    id: 2,
    text:
        'What is the time complexity of binary search on a sorted array of n elements?',
    options: ['O(n)', 'O(n²)', 'O(log n)', 'O(1)'],
    correctIndex: 2,
  ),
  _Question(
    id: 3,
    text:
        'In the OSI model, which layer is responsible for end-to-end communication and error recovery?',
    options: [
      'Network Layer',
      'Data Link Layer',
      'Transport Layer',
      'Session Layer',
    ],
    correctIndex: 2,
  ),
  _Question(
    id: 4,
    text: 'Which SQL clause is used to filter groups in a GROUP BY query?',
    options: ['WHERE', 'ORDER BY', 'HAVING', 'DISTINCT'],
    correctIndex: 2,
  ),
  _Question(
    id: 5,
    text:
        'What does CPU stand for and which component performs arithmetic operations?',
    options: [
      'Central Processing Unit — RAM',
      'Central Processing Unit — ALU',
      'Control Processing Unit — ALU',
      'Core Processing Unit — GPU',
    ],
    correctIndex: 1,
  ),
];

// ─────────────────────────────────────────────────────────────────────────────

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
  static const int _totalSeconds = 30 * 60; // 30 minutes
  int _remainingSeconds = _totalSeconds;
  Timer? _countdownTimer;
  bool _submitted = false;

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
    _initAnswers();
    _cacheExamLocally();
    _startTimer();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _countdownTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Auto-save progress when app is backgrounded (UC2.5)
    if (state == AppLifecycleState.paused && !_submitted) {
      _saveProgressLocally(status: 'in_progress');
    }
  }

  // ── Init helpers ────────────────────────────────────────────────────

  void _initAnswers() {
    for (final q in _kQuestions) {
      _answers[q.id] = -1; // -1 = unanswered
    }
  }

  Future<void> _cacheExamLocally() async {
    final exam = CachedExam(
      sessionId: widget.qrPayload,
      subject: 'A/L ICT',
      durationMinutes: _totalSeconds ~/ 60,
      questionsJson: jsonEncode(
        _kQuestions
            .map((q) => {
                  'id': q.id,
                  'text': q.text,
                  'options': q.options,
                })
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

  void _startTimer() {
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

  // ── SQLite persistence ───────────────────────────────────────────────

  Future<void> _saveProgressLocally({required String status}) async {
    if (_dbSaving) return;
    setState(() => _dbSaving = true);
    try {
      await DatabaseHelper.instance.saveProgress(
        sessionId: widget.qrPayload,
        answersJson: jsonEncode(_answers),
        status: status,
        totalScore: _calculateScore(),
      );
      if (mounted) setState(() => _saveStatus = 'Saved locally ✓');
    } catch (e) {
      if (mounted) setState(() => _saveStatus = 'Save failed — will retry');
    } finally {
      if (mounted) setState(() => _dbSaving = false);
    }
  }

  Future<void> _submitToDb() async {
    await DatabaseHelper.instance.markSubmitted(
      sessionId: widget.qrPayload,
      answersJson: jsonEncode(_answers),
      totalScore: _calculateScore(),
    );
  }

  int _calculateScore() {
    int score = 0;
    for (final q in _kQuestions) {
      if (_answers[q.id] == q.correctIndex) score++;
    }
    return score;
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

    await _submitToDb();
    _showResultsSheet();
  }

  Future<bool> _showConfirmDialog() async {
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Submit Exam?',
            style: TextStyle(fontWeight: FontWeight.bold)),
        content: Text(
          'You have answered '
          '${_answers.values.where((v) => v >= 0).length} of '
          '${_kQuestions.length} questions. '
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
    final total = _kQuestions.length;
    final pct = (score / total * 100).round();

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
        onClose: () => Navigator.of(context)
          ..pop()  // close sheet
          ..pop(), // back to home
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
      body: Column(
        children: [
          _buildTimerBanner(),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
              itemCount: _kQuestions.length,
              itemBuilder: (_, i) => _QuestionCard(
                question: _kQuestions[i],
                selectedIndex: _answers[_kQuestions[i].id] ?? -1,
                isSubmitted: _submitted,
                onSelected: _submitted
                    ? null
                    : (idx) => _selectAnswer(_kQuestions[i].id, idx),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomBar(),
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
                style:
                    const TextStyle(fontSize: 10, color: Colors.white70),
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
            style: TextStyle(
              fontSize: 11,
              color: _timerColor.withAlpha(180),
            ),
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
              '$_answeredCount / ${_kQuestions.length}',
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
          16, 12, 16, MediaQuery.of(context).padding.bottom + 12),
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
              value: _answeredCount / _kQuestions.length,
              backgroundColor: Colors.grey.shade200,
              valueColor:
                  const AlwaysStoppedAnimation<Color>(Colors.orange),
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
                backgroundColor:
                    _submitted ? Colors.grey : Colors.orange,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              onPressed:
                  _submitted ? null : () => _handleSubmit(),
              icon: Icon(
                _submitted ? Icons.check_circle : Icons.send_rounded,
                size: 18,
              ),
              label: Text(
                _submitted
                    ? 'Exam Submitted'
                    : 'Submit Answers ($_answeredCount/${_kQuestions.length})',
                style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.bold),
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
                isWrong: isSubmitted &&
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
                  fontWeight:
                      isSelected ? FontWeight.w600 : FontWeight.normal,
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
    required this.onClose,
  });

  final int score;
  final int total;
  final int percentage;
  final String sessionId;
  final VoidCallback onClose;

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
          24, 24, 24, MediaQuery.of(context).padding.bottom + 24),
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
                color: Colors.grey.shade900),
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
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.green.shade200),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.storage_rounded,
                    color: Colors.green.shade600, size: 14),
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
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Colors.orange,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: onClose,
              child: const Text(
                'Back to Home',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
