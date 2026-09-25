import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as path_pkg;
import '../models/cached_exam.dart';

/// DatabaseHelper — singleton SQLite service for offline exam caching (UC2.5).
///
/// Schema:
///   cached_exams
///     id             INTEGER PRIMARY KEY AUTOINCREMENT
///     session_id     TEXT NOT NULL UNIQUE
///     subject        TEXT NOT NULL
///     duration_minutes INTEGER NOT NULL
///     questions_json TEXT NOT NULL   -- JSON payload of MCQ questions
///     answers_json   TEXT NOT NULL   -- JSON payload of student answers
///     status         TEXT NOT NULL   -- pending | in_progress | submitted
///     total_score    INTEGER NOT NULL DEFAULT 0
///     created_at     TEXT NOT NULL   -- ISO 8601 timestamp
class DatabaseHelper {
  static const String _dbName = 'intelliprep_student.db';
  static const int _dbVersion = 1;
  static const String _tableName = 'cached_exams';

  /// Private constructor — use [instance] instead.
  DatabaseHelper._internal();

  static final DatabaseHelper instance = DatabaseHelper._internal();

  Database? _db;

  /// Returns the open database, initialising it on first call.
  Future<Database> get database async {
    _db ??= await _initDb();
    return _db!;
  }

  // ── Initialisation ────────────────────────────────────────────────

  Future<Database> _initDb() async {
    final dbPath = await getDatabasesPath();
    final fullPath = path_pkg.join(dbPath, _dbName);

    return openDatabase(
      fullPath,
      version: _dbVersion,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE $_tableName (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id       TEXT NOT NULL UNIQUE,
        subject          TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        questions_json   TEXT NOT NULL,
        answers_json     TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'pending',
        total_score      INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT NOT NULL
      )
    ''');
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    // Future migrations go here.
  }

  // ── CRUD Operations ───────────────────────────────────────────────

  /// Insert or replace an exam cache record.
  /// Returns the row id.
  Future<int> upsertExam(CachedExam exam) async {
    final db = await database;
    return db.insert(
      _tableName,
      exam.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Fetch all cached exams, newest first.
  Future<List<CachedExam>> getAllExams() async {
    final db = await database;
    final rows = await db.query(
      _tableName,
      orderBy: 'created_at DESC',
    );
    return rows.map(CachedExam.fromMap).toList();
  }

  /// Fetch a single exam by its [sessionId].
  /// Returns `null` if not found.
  Future<CachedExam?> getExamBySessionId(String sessionId) async {
    final db = await database;
    final rows = await db.query(
      _tableName,
      where: 'session_id = ?',
      whereArgs: [sessionId],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return CachedExam.fromMap(rows.first);
  }

  /// Update the answers JSON and status for an in-progress exam.
  Future<int> saveProgress({
    required String sessionId,
    required String answersJson,
    required String status,
    int totalScore = 0,
  }) async {
    final db = await database;
    return db.update(
      _tableName,
      {
        'answers_json': answersJson,
        'status': status,
        'total_score': totalScore,
      },
      where: 'session_id = ?',
      whereArgs: [sessionId],
    );
  }

  /// Mark an exam as submitted with its final score.
  Future<int> markSubmitted({
    required String sessionId,
    required String answersJson,
    required int totalScore,
  }) async {
    return saveProgress(
      sessionId: sessionId,
      answersJson: answersJson,
      status: 'submitted',
      totalScore: totalScore,
    );
  }

  /// Delete a cached exam by session ID.
  Future<int> deleteExam(String sessionId) async {
    final db = await database;
    return db.delete(
      _tableName,
      where: 'session_id = ?',
      whereArgs: [sessionId],
    );
  }

  /// Close the database connection. Call on app teardown if needed.
  Future<void> close() async {
    final db = _db;
    if (db != null) {
      await db.close();
      _db = null;
    }
  }
}
