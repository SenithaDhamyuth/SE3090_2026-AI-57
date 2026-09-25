/// Data model representing an exam session cached locally via SQLite.
/// Used by UC2.5 – Offline exam caching.
class CachedExam {
  final int? id;
  final String sessionId;
  final String subject;
  final int durationMinutes;
  final String questionsJson; // JSON array of question objects
  final String answersJson;   // JSON array of submitted answers
  final String status;        // "pending" | "in_progress" | "submitted"
  final int totalScore;
  final String createdAt;

  const CachedExam({
    this.id,
    required this.sessionId,
    required this.subject,
    required this.durationMinutes,
    required this.questionsJson,
    required this.answersJson,
    required this.status,
    required this.totalScore,
    required this.createdAt,
  });

  /// Convert model → row map for SQLite insert/update.
  Map<String, dynamic> toMap() {
    return {
      if (id != null) 'id': id,
      'session_id': sessionId,
      'subject': subject,
      'duration_minutes': durationMinutes,
      'questions_json': questionsJson,
      'answers_json': answersJson,
      'status': status,
      'total_score': totalScore,
      'created_at': createdAt,
    };
  }

  /// Convert a SQLite row map → model.
  factory CachedExam.fromMap(Map<String, dynamic> map) {
    return CachedExam(
      id: map['id'] as int?,
      sessionId: map['session_id'] as String,
      subject: map['subject'] as String,
      durationMinutes: map['duration_minutes'] as int,
      questionsJson: map['questions_json'] as String,
      answersJson: map['answers_json'] as String,
      status: map['status'] as String,
      totalScore: map['total_score'] as int,
      createdAt: map['created_at'] as String,
    );
  }

  /// Copy with updated fields.
  CachedExam copyWith({
    int? id,
    String? sessionId,
    String? subject,
    int? durationMinutes,
    String? questionsJson,
    String? answersJson,
    String? status,
    int? totalScore,
    String? createdAt,
  }) {
    return CachedExam(
      id: id ?? this.id,
      sessionId: sessionId ?? this.sessionId,
      subject: subject ?? this.subject,
      durationMinutes: durationMinutes ?? this.durationMinutes,
      questionsJson: questionsJson ?? this.questionsJson,
      answersJson: answersJson ?? this.answersJson,
      status: status ?? this.status,
      totalScore: totalScore ?? this.totalScore,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  String toString() =>
      'CachedExam(id: $id, sessionId: $sessionId, subject: $subject, status: $status)';
}
