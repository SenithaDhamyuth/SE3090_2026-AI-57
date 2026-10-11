import 'dart:convert';

import 'package:flutter/material.dart';

import '../ui/prep_ui.dart';

class ExamReviewScreen extends StatelessWidget {
  final String sessionId;
  final String subject;
  final String title;
  final int score;
  final int totalQuestions;
  final String date;
  final String questionsJson;
  final String answersJson;

  const ExamReviewScreen({
    super.key,
    required this.sessionId,
    required this.subject,
    required this.title,
    required this.score,
    required this.totalQuestions,
    required this.date,
    required this.questionsJson,
    required this.answersJson,
  });

  @override
  Widget build(BuildContext context) {
    List<dynamic> questions = [];
    Map<String, dynamic> answers = {};

    try {
      questions = jsonDecode(questionsJson);
    } catch (_) {}

    try {
      answers = jsonDecode(answersJson);
    } catch (_) {}

    return Scaffold(
      appBar: AppBar(title: const Text('Exam review')),
      body: PrepPage(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            PrepCard(
              color: PrepColors.navy,
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const PrepPill(
                    'YOUR RESULTS',
                    color: Color(0xFFD7F2B8),
                    background: Color(0xFF30535C),
                    icon: Icons.fact_check_outlined,
                  ),
                  const SizedBox(height: 20),
                  Text(
                    title,
                    style: Theme.of(context).textTheme.headlineMedium
                        ?.copyWith(color: Colors.white),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    subject,
                    style: const TextStyle(color: Color(0xFFDBEBEF)),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    '$score / $totalQuestions',
                    style: const TextStyle(
                      fontSize: 36,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  const Text(
                    'Correct answers',
                    style: TextStyle(color: Color(0xFFDBEBEF)),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    date,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFFDBEBEF),
                    ),
                  ),
                ],
              ),
            ),
            const PrepSection(title: 'Learn from your answers'),
            const Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                PrepPill('Correct answer', icon: Icons.check_circle_outline),
                PrepPill(
                  'Your incorrect answer',
                  icon: Icons.cancel_outlined,
                  color: PrepColors.error,
                  background: Color(0xFFFCE8E6),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (questions.isEmpty)
              const PrepState(
                title: 'Review details unavailable',
                message: 'Question data was not saved for this session. Your score is shown above.',
              )
            else
              ...List.generate(questions.length, (i) {
                final q = questions[i];
                final qText =
                    q['questionText'] ??
                    q['text'] ??
                    q['question'] ??
                    'Untitled';
                final options = List<String>.from(q['options'] ?? []);
                final rawCorrect =
                    q['correctOptionIndex'] ??
                    q['correctOption'] ??
                    q['correctIndex'] ??
                    q['answerIndex'] ??
                    q['answer'];
                final parsedCorrectIdx = int.tryParse('$rawCorrect');
                final correctIdx =
                    parsedCorrectIdx != null &&
                        parsedCorrectIdx >= 0 &&
                        parsedCorrectIdx < options.length
                    ? parsedCorrectIdx
                    : null;
                final qId =
                    (q['id'] ?? q['questionNo'] ?? q['questionId'])?.toString() ??
                    '${i + 1}';
                final selectedIdxRaw = answers[qId];
                final selectedIdx = selectedIdxRaw != null
                    ? int.tryParse('$selectedIdxRaw') ?? -1
                    : -1;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 20),
                  child: PrepCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            PrepPill('Question ${i + 1}'),
                            if (selectedIdx == -1)
                              const PrepPill(
                                'Unanswered',
                                color: PrepColors.amber,
                                background: Color(0xFFFFF2DE),
                              ),
                            if (correctIdx == null)
                              const PrepPill(
                                'Correct answer not saved',
                                color: PrepColors.muted,
                                background: PrepColors.canvas,
                              ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text(
                          qText,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 20),
                        ...List.generate(options.length, (optIdx) {
                          final isCorrect = correctIdx == optIdx;
                          final isSelected = selectedIdx == optIdx;
                          final isWrong =
                              isSelected && correctIdx != null && !isCorrect;
                          final color = isWrong
                              ? PrepColors.error
                              : isCorrect
                              ? PrepColors.primary
                              : PrepColors.muted;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Semantics(
                              selected: isSelected,
                              label:
                                  '${isCorrect ? 'Correct answer. ' : ''}${isSelected ? 'Your answer. ' : ''}',
                              child: Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: isCorrect || isWrong
                                      ? color.withAlpha(14)
                                      : PrepColors.canvas,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: isCorrect || isWrong
                                        ? color
                                        : PrepColors.line,
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${String.fromCharCode(65 + optIdx)}. ${options[optIdx]}',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyLarge,
                                    ),
                                    if (isCorrect || isSelected) ...[
                                      const SizedBox(height: 8),
                                      Text(
                                        correctIdx == null && isSelected
                                            ? 'Your answer · correctness unavailable'
                                            : isCorrect
                                            ? (isSelected
                                                  ? '✓ Correct · Your answer'
                                                  : '✓ Correct answer')
                                            : '× Your answer',
                                        style: TextStyle(
                                          color: color,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          );
                        }),
                        if (q['explanation'] != null &&
                            q['explanation'].toString().isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: PrepColors.mint,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Why this answer?',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: PrepColors.primary,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  q['explanation'].toString(),
                                  style: const TextStyle(
                                    color: PrepColors.ink,
                                    height: 1.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
