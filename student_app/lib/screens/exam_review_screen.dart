import 'dart:convert';
import 'package:flutter/material.dart';

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
      appBar: AppBar(
        title: const Text('Exam Review', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.orange,
        foregroundColor: Colors.white,
      ),
      backgroundColor: const Color(0xFFFAFAFA),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(bottom: BorderSide(color: Color(0xFFEEEEEE))),
              ),
              child: Column(
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '$subject • $date',
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.orange.withAlpha(20),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.orange.withAlpha(50)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.stars_rounded, color: Colors.orange),
                        const SizedBox(width: 8),
                        Text(
                          'Score: $score / $totalQuestions',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.orange,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (questions.isEmpty)
            const SliverFillRemaining(
              child: Center(
                child: Text('No questions data available for this session.', style: TextStyle(color: Colors.grey)),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final q = questions[i];
                    final qText = q['questionText'] ?? q['text'] ?? q['question'] ?? 'Untitled';
                    final options = List<String>.from(q['options'] ?? []);
                    
                    // Handle various correctOptionIndex formats
                    final rawCorrect = q['correctOptionIndex'] ?? q['correctOption'] ?? q['correctIndex'] ?? q['answerIndex'] ?? q['answer'];
                    final correctIdx = int.tryParse('$rawCorrect') ?? 0;

                    // Get user's answer for this question ID. 
                    // Answers JSON usually uses string keys like "1", "2"
                    final qId = q['id']?.toString() ?? '${i + 1}';
                    final selectedIdxRaw = answers[qId];
                    final selectedIdx = selectedIdxRaw != null ? int.tryParse('$selectedIdxRaw') ?? -1 : -1;

                    return Card(
                      elevation: 0,
                      margin: const EdgeInsets.only(bottom: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(color: Colors.grey.shade200),
                      ),
                      color: Colors.white,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
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
                                      '${i + 1}',
                                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    qText,
                                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, height: 1.4),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            ...List.generate(options.length, (optIdx) {
                              final isCorrect = correctIdx == optIdx;
                              final isSelected = selectedIdx == optIdx;
                              final isWrong = isSelected && !isCorrect;

                              Color bgColor = Colors.transparent;
                              Color borderColor = Colors.grey.shade300;
                              Widget trailing = const SizedBox();

                              if (isCorrect) {
                                bgColor = Colors.green.shade50;
                                borderColor = Colors.green;
                                trailing = const Icon(Icons.check_circle, color: Colors.green, size: 20);
                              } else if (isWrong) {
                                bgColor = Colors.red.shade50;
                                borderColor = Colors.red;
                                trailing = const Icon(Icons.cancel, color: Colors.red, size: 20);
                              }

                              return Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                decoration: BoxDecoration(
                                  color: bgColor,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: borderColor, width: 1.5),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 26,
                                      height: 26,
                                      decoration: BoxDecoration(
                                        color: isCorrect ? Colors.green : isWrong ? Colors.red : Colors.grey.shade200,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Center(
                                        child: Text(
                                          String.fromCharCode(65 + optIdx),
                                          style: TextStyle(
                                            color: (isCorrect || isWrong) ? Colors.white : Colors.grey.shade700,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        options[optIdx],
                                        style: TextStyle(
                                          fontSize: 14,
                                          color: (isCorrect || isWrong) ? Colors.black87 : Colors.grey.shade800,
                                          fontWeight: (isCorrect || isWrong) ? FontWeight.w600 : FontWeight.normal,
                                        ),
                                      ),
                                    ),
                                    trailing,
                                  ],
                                ),
                              );
                            }),
                            if (q['explanation'] != null && q['explanation'].toString().isNotEmpty) ...[
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.blue.shade50,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.blue.shade100),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(Icons.lightbulb_outline, size: 20, color: Colors.blue.shade700),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        q['explanation'].toString(),
                                        style: TextStyle(fontSize: 13, color: Colors.blue.shade900),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ]
                          ],
                        ),
                      ),
                    );
                  },
                  childCount: questions.length,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
