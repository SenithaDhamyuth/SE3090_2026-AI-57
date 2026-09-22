import 'package:flutter/material.dart';
import '../models/cached_exam.dart';
import '../services/database_helper.dart';
import 'qr_scanner_screen.dart';
import 'exam_timer_screen.dart';

/// HomeScreen — the main entry screen of the IntelliPrep Student App.
///
/// Shows a welcome header, the primary CTA (scan QR to start exam), a quick
/// demo shortcut that skips scanning, and a list of past sessions cached
/// locally via SQLite (UC2.5).
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<CachedExam> _cachedExams = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadCachedExams();
  }

  Future<void> _loadCachedExams() async {
    setState(() => _loading = true);
    try {
      final exams = await DatabaseHelper.instance.getAllExams();
      if (mounted) setState(() => _cachedExams = exams);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openQRScanner() {
    Navigator.of(context)
        .push(MaterialPageRoute<void>(
          builder: (_) => const QRScannerScreen(),
        ))
        .then((_) => _loadCachedExams());
  }

  /// Demo shortcut: launch exam directly without scanning.
  void _openDemoExam() {
    final demoSessionId =
        'INTELLIPREP:DEMO:${DateTime.now().millisecondsSinceEpoch}';
    Navigator.of(context)
        .push(MaterialPageRoute<void>(
          builder: (_) => ExamTimerScreen(qrPayload: demoSessionId),
        ))
        .then((_) => _loadCachedExams());
  }

  // ── Build ──────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      body: SafeArea(
        child: RefreshIndicator(
          color: Colors.orange,
          onRefresh: _loadCachedExams,
          child: CustomScrollView(
            slivers: [
              // ── Header sliver ───────────────────────────────────────
              SliverToBoxAdapter(child: _buildHeader()),

              // ── CTA cards ───────────────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Column(
                    children: [
                      _PrimaryActionCard(
                        icon: Icons.qr_code_scanner,
                        title: 'Scan QR to Start Exam',
                        subtitle: 'UC2.2 · Scan the code shown by your tutor',
                        accentColor: Colors.orange,
                        onTap: _openQRScanner,
                      ),
                      const SizedBox(height: 10),
                      _PrimaryActionCard(
                        icon: Icons.play_circle_outline_rounded,
                        title: 'Demo Exam (Skip Scan)',
                        subtitle: 'UC2.5 · Launch a sample A/L ICT session',
                        accentColor: Colors.deepOrange,
                        onTap: _openDemoExam,
                      ),
                    ],
                  ),
                ),
              ),

              // ── Cached exams section ────────────────────────────────
              SliverToBoxAdapter(
                child: Padding(
                  padding:
                      const EdgeInsets.fromLTRB(20, 24, 20, 8),
                  child: Row(
                    children: [
                      const Text(
                        'Recent Sessions',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1A1A1A),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        'Stored offline · UC2.5',
                        style: TextStyle(
                            fontSize: 10, color: Colors.grey.shade500,
                            fontFamily: 'monospace'),
                      ),
                    ],
                  ),
                ),
              ),

              if (_loading)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Center(
                      child: CircularProgressIndicator(color: Colors.orange),
                    ),
                  ),
                )
              else if (_cachedExams.isEmpty)
                SliverToBoxAdapter(child: _buildEmptyState())
              else
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => _SessionTile(exam: _cachedExams[i]),
                    childCount: _cachedExams.length,
                  ),
                ),

              const SliverToBoxAdapter(child: SizedBox(height: 32)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colors.orange, Color(0xFFE65100)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(40),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: Colors.white.withAlpha(60)),
                ),
                child: const Icon(Icons.school_rounded,
                    color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'IntelliPrep',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        letterSpacing: -0.3,
                      ),
                    ),
                    Text(
                      'Student Assessment App · v1.0',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ),
              // Offline indicator
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withAlpha(30),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: Colors.white.withAlpha(60)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.wifi_off_rounded,
                        color: Colors.white70, size: 11),
                    SizedBox(width: 4),
                    Text(
                      'Offline Ready',
                      style:
                          TextStyle(color: Colors.white70, fontSize: 10),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'Welcome back, Student!',
            style: TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 2),
          const Text(
            'A/L ICT — Sri Lanka National Curriculum',
            style: TextStyle(color: Colors.white70, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
      child: Column(
        children: [
          Icon(Icons.assignment_outlined,
              size: 48, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Text(
            'No sessions yet',
            style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Colors.grey.shade500),
          ),
          const SizedBox(height: 4),
          Text(
            'Scan a QR code or try the demo exam to get started.',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade400),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ── Primary action card ───────────────────────────────────────────────────

class _PrimaryActionCard extends StatelessWidget {
  const _PrimaryActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accentColor,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color accentColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
          boxShadow: [
            BoxShadow(
              color: accentColor.withAlpha(20),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: accentColor.withAlpha(20),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: accentColor, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1A1A1A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                        fontSize: 11, color: Colors.grey.shade500),
                  ),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios_rounded,
                size: 14, color: Colors.grey.shade400),
          ],
        ),
      ),
    );
  }
}

// ── Session list tile ────────────────────────────────────────────────────

class _SessionTile extends StatelessWidget {
  const _SessionTile({required this.exam});

  final CachedExam exam;

  Color get _statusColor {
    switch (exam.status) {
      case 'submitted':
        return Colors.green;
      case 'in_progress':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  String get _statusLabel {
    switch (exam.status) {
      case 'submitted':
        return 'Submitted';
      case 'in_progress':
        return 'In Progress';
      default:
        return 'Pending';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          // Subject icon
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: Colors.orange.withAlpha(20),
              borderRadius: BorderRadius.circular(10),
            ),
            child:
                const Icon(Icons.laptop_mac, color: Colors.orange, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  exam.subject,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A1A1A),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  exam.sessionId.length > 28
                      ? '${exam.sessionId.substring(0, 28)}…'
                      : exam.sessionId,
                  style: TextStyle(
                      fontSize: 10,
                      color: Colors.grey.shade400,
                      fontFamily: 'monospace'),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: _statusColor.withAlpha(25),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _statusColor.withAlpha(60)),
                ),
                child: Text(
                  _statusLabel,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: _statusColor,
                  ),
                ),
              ),
              if (exam.status == 'submitted') ...[
                const SizedBox(height: 4),
                Text(
                  '${exam.totalScore} pts',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: Colors.green,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
