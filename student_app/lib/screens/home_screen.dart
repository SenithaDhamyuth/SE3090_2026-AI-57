import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/cached_exam.dart';
import '../services/database_helper.dart';
import 'qr_scanner_screen.dart';
import 'exam_timer_screen.dart';
import 'login_screen.dart';

/// HomeScreen — main shell of the IntelliPrep Student App.
///
/// Hosts a [BottomNavigationBar] with three tabs:
///   • Tab 0 — Dashboard  : welcome card, next study task, QR FAB
///   • Tab 1 — Study Plan : AI-generated day-by-day topic timeline
///   • Tab 2 — Progress   : past exam marks and completed sessions
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  // ── Student info (loaded from prefs) ──────────────────────────────────
  String _studentEmail = 'student@school.lk';

  // ── Past sessions (loaded from SQLite) ────────────────────────────────
  List<CachedExam> _cachedExams = [];
  bool _loadingExams = true;

  @override
  void initState() {
    super.initState();
    _loadStudentInfo();
    _loadCachedExams();
  }

  Future<void> _loadStudentInfo() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _studentEmail = prefs.getString('student_email') ?? 'student@school.lk';
    });
  }

  Future<void> _loadCachedExams() async {
    setState(() => _loadingExams = true);
    try {
      final exams = await DatabaseHelper.instance.getAllExams();
      if (mounted) setState(() => _cachedExams = exams);
    } finally {
      if (mounted) setState(() => _loadingExams = false);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────

  void _openQRScanner() {
    Navigator.of(context)
        .push(MaterialPageRoute<void>(
          builder: (_) => const QRScannerScreen(),
        ))
        .then((_) => _loadCachedExams());
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Sign out?',
            style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('You will be returned to the login screen.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.orange),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');

    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  // ── Tabs ──────────────────────────────────────────────────────────────

  List<Widget> get _tabs => [
        _DashboardTab(
          email: _studentEmail,
          onScanQR: _openQRScanner,
        ),
        const _StudyPlanTab(),
        _ProgressTab(
          cachedExams: _cachedExams,
          isLoading: _loadingExams,
          onRefresh: _loadCachedExams,
        ),
      ];

  // ── Build ─────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: _buildAppBar(),
      body: IndexedStack(
        index: _currentIndex,
        children: _tabs,
      ),
      floatingActionButton: _currentIndex == 0
          ? FloatingActionButton.extended(
              onPressed: _openQRScanner,
              backgroundColor: Colors.orange,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.qr_code_scanner_rounded),
              label: const Text(
                'Scan QR for Exam',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              elevation: 4,
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        selectedItemColor: Colors.orange,
        unselectedItemColor: Colors.grey.shade500,
        backgroundColor: Colors.white,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
        selectedLabelStyle:
            const TextStyle(fontWeight: FontWeight.w600, fontSize: 11),
        unselectedLabelStyle: const TextStyle(fontSize: 11),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard_rounded),
            label: 'Dashboard',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.menu_book_outlined),
            activeIcon: Icon(Icons.menu_book_rounded),
            label: 'Study Plan',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.bar_chart_outlined),
            activeIcon: Icon(Icons.bar_chart_rounded),
            label: 'Progress',
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    const _tabTitles = ['Dashboard', 'Study Plan', 'Progress'];
    return AppBar(
      backgroundColor: Colors.orange,
      foregroundColor: Colors.white,
      elevation: 0,
      title: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(40),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.school_rounded,
                color: Colors.white, size: 18),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'IntelliPrep · ${_tabTitles[_currentIndex]}',
                style: const TextStyle(
                    fontSize: 15, fontWeight: FontWeight.bold),
              ),
              Text(
                _studentEmail,
                style: const TextStyle(
                    fontSize: 10, color: Colors.white70),
              ),
            ],
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.logout_rounded),
          tooltip: 'Sign out',
          onPressed: _logout,
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 0 — DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

class _DashboardTab extends StatelessWidget {
  const _DashboardTab({
    required this.email,
    required this.onScanQR,
  });

  final String email;
  final VoidCallback onScanQR;

  /// Extract first name from email for a friendlier greeting.
  String get _firstName {
    final local = email.split('@').first;
    if (local.isEmpty) return 'Student';
    return '${local[0].toUpperCase()}${local.substring(1)}';
  }

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        // ── Welcome banner ─────────────────────────────────────────────
        SliverToBoxAdapter(child: _WelcomeBanner(firstName: _firstName)),

        // ── Next task card ─────────────────────────────────────────────
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 20, 16, 0),
            child: _SectionHeader(
              icon: Icons.bolt_rounded,
              title: 'Next Study Task',
              color: Colors.deepOrange,
            ),
          ),
        ),
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: _NextTaskCard(),
          ),
        ),

        // ── Quick actions ──────────────────────────────────────────────
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 24, 16, 0),
            child: _SectionHeader(
              icon: Icons.flash_on_rounded,
              title: 'Quick Actions',
              color: Colors.orange,
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: _QuickActionCard(
              icon: Icons.qr_code_scanner_rounded,
              title: 'Scan QR to Start Exam',
              subtitle: 'UC2.2 · Scan the code shown by your tutor',
              accentColor: Colors.orange,
              onTap: onScanQR,
            ),
          ),
        ),

        // ── Bottom padding so FAB doesn't overlap ─────────────────────
        const SliverToBoxAdapter(child: SizedBox(height: 96)),
      ],
    );
  }
}

class _WelcomeBanner extends StatelessWidget {
  const _WelcomeBanner({required this.firstName});

  final String firstName;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 22),
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
          Text(
            'Welcome back, $firstName! 👋',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'A/L ICT — Sri Lanka National Curriculum',
            style: TextStyle(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 16),
          // At-a-glance stats row
          Row(
            children: [
              _StatChip(
                  icon: Icons.calendar_today_rounded,
                  label: 'Day 5 of 30'),
              const SizedBox(width: 10),
              _StatChip(
                  icon: Icons.emoji_events_rounded,
                  label: '68% avg score'),
              const SizedBox(width: 10),
              _StatChip(
                  icon: Icons.check_circle_outline_rounded,
                  label: '4 sessions done'),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(30),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withAlpha(60)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 12),
          const SizedBox(width: 5),
          Text(label,
              style: const TextStyle(color: Colors.white, fontSize: 10)),
        ],
      ),
    );
  }
}

class _NextTaskCard extends StatelessWidget {
  const _NextTaskCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.orange.withAlpha(60)),
        boxShadow: [
          BoxShadow(
            color: Colors.orange.withAlpha(20),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: Colors.deepOrange.withAlpha(20),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.lightbulb_outline_rounded,
                color: Colors.deepOrange, size: 26),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Day 5 — Data Communication',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A1A1A),
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'AI-recommended: Review OSI model layers & protocols',
                  style: TextStyle(fontSize: 11, color: Colors.grey),
                ),
                SizedBox(height: 8),
                LinearProgressIndicator(
                  value: 0.40,
                  backgroundColor: Color(0xFFEEEEEE),
                  valueColor:
                      AlwaysStoppedAnimation<Color>(Colors.deepOrange),
                  minHeight: 5,
                  borderRadius: BorderRadius.all(Radius.circular(4)),
                ),
                SizedBox(height: 4),
                Text(
                  '40% of day plan complete',
                  style: TextStyle(fontSize: 10, color: Colors.grey),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  const _QuickActionCard({
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
                  Text(title,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1A1A1A))),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: TextStyle(
                          fontSize: 11, color: Colors.grey.shade500)),
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

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — STUDY PLAN
// ═══════════════════════════════════════════════════════════════════════════

/// Mock AI-generated study plan data for A/L ICT.
class _StudyDay {
  final int day;
  final String date;
  final String topic;
  final String subtopics;
  final String priority;

  const _StudyDay({
    required this.day,
    required this.date,
    required this.topic,
    required this.subtopics,
    required this.priority,
  });

  factory _StudyDay.fromJson(Map<String, dynamic> json) {
    return _StudyDay(
      day: json['day'] ?? 0,
      date: json['date'] ?? '',
      topic: json['topic'] ?? 'Unknown Topic',
      subtopics: json['subtopics'] ?? '',
      priority: json['priority'] ?? 'Medium',
    );
  }
}

class _StudyPlanTab extends StatefulWidget {
  const _StudyPlanTab();

  @override
  State<_StudyPlanTab> createState() => _StudyPlanTabState();
}

class _StudyPlanTabState extends State<_StudyPlanTab> {
  late Future<Map<String, dynamic>> _planFuture;

  @override
  void initState() {
    super.initState();
    _planFuture = _fetchStudyPlan();
  }

  Future<Map<String, dynamic>> _fetchStudyPlan() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token') ?? '';
    final ip = prefs.getString('backend_ip') ?? '192.168.1.146';
    
    final url = Uri.parse('http://$ip:5087/api/student/my-plan');
    final response = await http.get(url, headers: {
      'Authorization': 'Bearer $token',
    });

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final scheduleList = data['schedule'] as List<dynamic>;
      final days = scheduleList.map((e) => _StudyDay.fromJson(e)).toList();
      return {
        'targetDate': data['targetExamDate'] ?? 'Unknown',
        'days': days,
      };
    } else if (response.statusCode == 404) {
      throw Exception('Waiting for admin approval.');
    } else {
      throw Exception('Failed to load study plan.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _planFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: Colors.orange));
        }

        if (snapshot.hasError) {
          final isApproval = snapshot.error.toString().contains('approval');
          return Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(isApproval ? Icons.hourglass_empty_rounded : Icons.error_outline_rounded,
                      size: 64, color: isApproval ? Colors.orange : Colors.red),
                  const SizedBox(height: 16),
                  Text(
                    snapshot.error.toString().replaceAll('Exception: ', ''),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 16, color: Colors.black87, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    isApproval 
                      ? 'Your AI-generated plan is waiting for a tutor to review and approve it.'
                      : 'Please check your connection or backend IP settings.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: () {
                      setState(() {
                        _planFuture = _fetchStudyPlan();
                      });
                    },
                    style: FilledButton.styleFrom(backgroundColor: Colors.orange),
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: const Text('Refresh'),
                  )
                ],
              ),
            ),
          );
        }

        final data = snapshot.data!;
        final targetDate = data['targetDate'] as String;
        final plan = data['days'] as List<_StudyDay>;

        return CustomScrollView(
          slivers: [
            // ── Header ────────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Colors.orange, Color(0xFFE65100)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'AI-Generated Study Plan',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Target exam: $targetDate · personalised for you',
                      style: const TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                    const SizedBox(height: 14),
                  ],
                ),
              ),
            ),
            // ── Timeline list ──────────────────────────────────────────────
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final day = plan[index];
                  final isLast = index == plan.length - 1;
                  return _StudyDayTile(day: day, isLast: isLast, isCurrent: index == 0); // Mock first day as current
                },
                childCount: plan.length,
              ),
            ),
            // ── Footer ────────────────────────────────────────────────────
            const SliverToBoxAdapter(child: SizedBox(height: 80)),
          ],
        );
      },
    );
  }
}

class _StudyDayTile extends StatelessWidget {
  const _StudyDayTile({required this.day, required this.isLast, required this.isCurrent});

  final _StudyDay day;
  final bool isLast;
  final bool isCurrent; // Just for visual mock

  Color get _dotColor {
    if (isCurrent) return Colors.orange;
    return Colors.grey.shade300;
  }
  
  Color get _priorityColor {
    switch (day.priority) {
      case 'High': return Colors.red;
      case 'Medium': return Colors.orange;
      case 'Low': return Colors.green;
      default: return Colors.blue;
    }
  }

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Timeline column ──────────────────────────────────────────
          SizedBox(
            width: 56,
            child: Column(
              children: [
                const SizedBox(height: 20),
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: _dotColor,
                    shape: BoxShape.circle,
                    boxShadow: isCurrent
                        ? [BoxShadow(color: Colors.orange.withAlpha(80), blurRadius: 8)]
                        : [],
                  ),
                  child: Center(
                    child: Text(
                      '${day.day}',
                      style: TextStyle(
                        color: isCurrent ? Colors.white : Colors.grey.shade500,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      color: Colors.grey.shade200,
                    ),
                  ),
              ],
            ),
          ),
          // ── Content ──────────────────────────────────────────────────
          Expanded(
            child: Padding(
              padding: EdgeInsets.fromLTRB(4, 12, 16, isLast ? 12 : 20),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: isCurrent ? Colors.orange.withAlpha(12) : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: isCurrent ? Colors.orange.withAlpha(80) : Colors.grey.shade200,
                    width: isCurrent ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: _priorityColor.withAlpha(30),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.menu_book_rounded, color: _priorityColor, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  'Day ${day.day}: ${day.topic}',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF1A1A1A),
                                  ),
                                ),
                              ),
                              if (isCurrent)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.orange,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Text(
                                    'Today',
                                    style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            day.date,
                            style: TextStyle(fontSize: 10, color: Colors.grey.shade400, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            day.subtopics,
                            style: TextStyle(fontSize: 11, color: Colors.grey.shade500, height: 1.4),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — PROGRESS
// ═══════════════════════════════════════════════════════════════════════════

class _ProgressTab extends StatelessWidget {
  const _ProgressTab({
    required this.cachedExams,
    required this.isLoading,
    required this.onRefresh,
  });

  final List<CachedExam> cachedExams;
  final bool isLoading;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: Colors.orange,
      onRefresh: onRefresh,
      child: CustomScrollView(
        slivers: [
          // ── Summary header ───────────────────────────────────────────
          SliverToBoxAdapter(
            child: _ProgressHeader(exams: cachedExams),
          ),

          // ── Section label ────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
              child: Row(
                children: [
                  const _SectionHeader(
                    icon: Icons.history_rounded,
                    title: 'Past Sessions',
                    color: Colors.orange,
                  ),
                  const Spacer(),
                  Text(
                    'Pull to refresh',
                    style: TextStyle(
                        fontSize: 10, color: Colors.grey.shade400),
                  ),
                ],
              ),
            ),
          ),

          // ── List or states ───────────────────────────────────────────
          if (isLoading)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(
                    child: CircularProgressIndicator(color: Colors.orange)),
              ),
            )
          else if (cachedExams.isEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                    vertical: 40, horizontal: 28),
                child: Column(
                  children: [
                    Icon(Icons.assignment_outlined,
                        size: 52, color: Colors.grey.shade300),
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
                      'Scan a QR code from the Dashboard to start your first exam session.',
                      style: TextStyle(
                          fontSize: 12, color: Colors.grey.shade400),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, i) => _SessionTile(exam: cachedExams[i]),
                childCount: cachedExams.length,
              ),
            ),

          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ],
      ),
    );
  }
}

class _ProgressHeader extends StatelessWidget {
  const _ProgressHeader({required this.exams});

  final List<CachedExam> exams;

  int get _submitted =>
      exams.where((e) => e.status == 'submitted').length;
  int get _inProgress =>
      exams.where((e) => e.status == 'in_progress').length;
  double get _avgScore {
    final scored = exams
        .where((e) => e.status == 'submitted' && e.totalScore > 0)
        .toList();
    if (scored.isEmpty) return 0;
    return scored.map((e) => e.totalScore).reduce((a, b) => a + b) /
        scored.length;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 22),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.orange, Color(0xFFE65100)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Your Progress',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Exam history and performance overview',
            style: TextStyle(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _ProgressStat(
                  label: 'Submitted', value: '$_submitted'),
              const SizedBox(width: 12),
              _ProgressStat(
                  label: 'In Progress', value: '$_inProgress'),
              const SizedBox(width: 12),
              _ProgressStat(
                  label: 'Avg Score',
                  value: exams.isEmpty
                      ? '—'
                      : '${_avgScore.toStringAsFixed(1)} pts'),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProgressStat extends StatelessWidget {
  const _ProgressStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(25),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withAlpha(50)),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(color: Colors.white70, fontSize: 10),
            ),
          ],
        ),
      ),
    );
  }
}

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

  IconData get _statusIcon {
    switch (exam.status) {
      case 'submitted':
        return Icons.check_circle_rounded;
      case 'in_progress':
        return Icons.timelapse_rounded;
      default:
        return Icons.pending_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(6),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          // Subject icon
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.orange.withAlpha(20),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.laptop_mac_rounded,
                color: Colors.orange, size: 22),
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
                const SizedBox(height: 3),
                Text(
                  exam.sessionId.length > 28
                      ? '${exam.sessionId.substring(0, 28)}…'
                      : exam.sessionId,
                  style: TextStyle(
                    fontSize: 10,
                    color: Colors.grey.shade400,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: _statusColor.withAlpha(25),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _statusColor.withAlpha(60)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(_statusIcon, color: _statusColor, size: 10),
                    const SizedBox(width: 4),
                    Text(
                      _statusLabel,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: _statusColor,
                      ),
                    ),
                  ],
                ),
              ),
              if (exam.status == 'submitted') ...[
                const SizedBox(height: 5),
                Text(
                  '${exam.totalScore} pts',
                  style: const TextStyle(
                    fontSize: 13,
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

// ═══════════════════════════════════════════════════════════════════════════
// SHARED UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.title,
    required this.color,
  });

  final IconData icon;
  final String title;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: color, size: 16),
        const SizedBox(width: 6),
        Text(
          title,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.bold,
            color: Color(0xFF1A1A1A),
          ),
        ),
      ],
    );
  }
}
