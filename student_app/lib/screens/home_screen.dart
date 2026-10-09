import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api_constants.dart';
import '../models/cached_exam.dart';
import '../services/database_helper.dart';
import 'qr_scanner_screen.dart';
import 'login_screen.dart';
import 'exam_review_screen.dart';
import 'profile_screen.dart';

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

  void _openProfile() {
    Navigator.of(context)
        .push(MaterialPageRoute<void>(
          builder: (_) => const ProfileScreen(),
        ))
        .then((_) => _loadStudentInfo());
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
    const tabTitles = ['Dashboard', 'Study Plan', 'Progress'];
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
                'IntelliPrep · ${tabTitles[_currentIndex]}',
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
          icon: const Icon(Icons.account_circle_outlined),
          tooltip: 'My Profile',
          onPressed: _openProfile,
        ),
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
  final String topic;
  final String subtopics;
  final String priority;

  const _StudyDay({
    required this.day,
    required this.topic,
    required this.subtopics,
    required this.priority,
  });

  factory _StudyDay.fromJson(Map<String, dynamic> json) {
    return _StudyDay(
      day: json['day'] ?? 0,
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
  bool _isLoading = true;
  String? _errorMsg;
  List<_StudyDay> _plan = [];

  @override
  void initState() {
    super.initState();
    _loadPlan();
  }

  Future<void> _loadPlan() async {
    setState(() {
      _isLoading = true;
      _errorMsg = null;
    });
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? '';
      final url = ApiConstants.endpoint('api/student/my-plan');
      final response = await http.get(url, headers: {
        'Authorization': 'Bearer $token',
      });

      if (!mounted) return;

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final scheduleList = data['schedule'] as List<dynamic>;
        final days = scheduleList.map((e) => _StudyDay.fromJson(e)).toList();
        setState(() {
          _plan = days;
        });
      } else if (response.statusCode == 404) {
        setState(() => _errorMsg = 'Waiting for admin to publish your plan.');
      } else {
        setState(() => _errorMsg = 'Failed to load study plan.');
      }
    } catch (_) {
      if (mounted) setState(() => _errorMsg = 'Failed to load study plan.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// Called by the [RefreshIndicator]; returns a Future so the spinner stays
  /// until the load is complete.
  Future<void> _refresh() async {
    setState(() {
      _isLoading = true;
      _errorMsg = null;
    });
    await _loadPlan();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.orange),
      );
    }

    if (_errorMsg != null) {
      final isWaiting = _errorMsg!.contains('publish') || _errorMsg!.contains('admin');
      return RefreshIndicator(
        onRefresh: _refresh,
        color: Colors.orange,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.7,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        isWaiting
                            ? Icons.hourglass_empty_rounded
                            : Icons.error_outline_rounded,
                        size: 64,
                        color: isWaiting ? Colors.orange : Colors.red,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        _errorMsg!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 16,
                          color: Colors.black87,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        isWaiting
                            ? 'Your AI-generated plan is waiting for a tutor to review and approve it.'
                            : 'Please check your internet connection and try again.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.grey),
                      ),
                      const SizedBox(height: 24),
                      FilledButton.icon(
                        onPressed: _loadPlan,
                        style: FilledButton.styleFrom(
                            backgroundColor: Colors.orange),
                        icon: const Icon(Icons.refresh_rounded, size: 18),
                        label: const Text('Refresh'),
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

    return RefreshIndicator(
      onRefresh: _refresh,
      color: Colors.orange,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
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
                  const SizedBox(height: 14),
                ],
              ),
            ),
          ),
          // ── Timeline list ──────────────────────────────────────────────
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final day = _plan[index];
                final isLast = index == _plan.length - 1;
                return _StudyDayTile(
                    day: day, dayNumber: index + 1, isLast: isLast);
              },
              childCount: _plan.length,
            ),
          ),
          // ── Footer ────────────────────────────────────────────────────
          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
    );
  }
}

class _StudyDayTile extends StatelessWidget {
  const _StudyDayTile({required this.day, required this.dayNumber, required this.isLast});

  final _StudyDay day;
  final int dayNumber;
  final bool isLast;

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
                    color: Colors.grey.shade700,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      '$dayNumber',
                      style: const TextStyle(
                        color: Colors.white,
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
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: Colors.grey.shade200,
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
                                  'Day $dayNumber: ${day.topic}',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF1A1A1A),
                                  ),
                                ),
                              ),
                            ],
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
// TAB 2 — PROGRESS (fetches live results from backend)
// ═══════════════════════════════════════════════════════════════════════════

class _RemoteResult {
  final String sessionGuid;
  final String status;
  final String subject;
  final String title;
  final int totalScore;
  final int totalQuestions;
  final String? endTime;
  final int durationMinutes;
  final String? questionsJson;
  final String? answersJson;

  const _RemoteResult({
    required this.sessionGuid,
    required this.status,
    required this.subject,
    required this.title,
    required this.totalScore,
    required this.totalQuestions,
    required this.endTime,
    required this.durationMinutes,
    this.questionsJson,
    this.answersJson,
  });

  factory _RemoteResult.fromJson(Map<String, dynamic> json) {
    final subject = (json['subject'] ??
            json['Subject'] ??
            json['title'] ??
            json['Title'] ??
            'Exam')
        .toString();
    return _RemoteResult(
      sessionGuid: (json['sessionGuid'] ?? json['SessionGuid'] ?? '').toString(),
      status: (json['status'] ?? json['Status'] ?? '').toString(),
      subject: subject,
      title: (json['title'] ??
              json['Title'] ??
              json['subject'] ??
              json['Subject'] ??
              'Exam')
          .toString(),
      totalScore: _readInt(json['totalScore'] ?? json['TotalScore']),
      totalQuestions: _readInt(json['totalQuestions'] ?? json['TotalQuestions']),
      endTime: (json['endTime'] ?? json['EndTime'])?.toString(),
      durationMinutes: _readInt(json['durationMinutes'] ?? json['DurationMinutes'], 30),
      questionsJson: (json['questionsJson'] ?? json['QuestionsJson'])?.toString(),
      answersJson: (json['answersJson'] ?? json['AnswersJson'])?.toString(),
    );
  }

  static int _readInt(dynamic value, [int fallback = 0]) =>
      value is num ? value.toInt() : int.tryParse('$value') ?? fallback;
}


class _ProgressTab extends StatefulWidget {
  const _ProgressTab({
    required this.cachedExams,
    required this.isLoading,
    required this.onRefresh,
  });

  final List<CachedExam> cachedExams;
  final bool isLoading;
  final Future<void> Function() onRefresh;

  @override
  State<_ProgressTab> createState() => _ProgressTabState();
}

class _ProgressTabState extends State<_ProgressTab> {
  List<_RemoteResult> _remoteResults = [];
  bool _loadingRemote = true;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _fetchRemoteResults();
  }

  Future<void> _fetchRemoteResults() async {
    setState(() { _loadingRemote = true; });
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? '';
      if (token.isEmpty) {
        setState(() { _loadingRemote = false; });
        return;
      }
      final url = ApiConstants.endpoint('api/student/my-results');
      final response = await http.get(url, headers: {
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
      }).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        final dynamic rawResults = decoded is List
            ? decoded
            : decoded is Map
                ? decoded['results'] ?? decoded['Results'] ?? decoded['data'] ?? decoded['Data']
                : null;
        final list = rawResults is List ? rawResults : <dynamic>[];
        setState(() {
          _remoteResults = list
              .whereType<Map>()
              .map((e) => _RemoteResult.fromJson(Map<String, dynamic>.from(e)))
              .toList();
          _loadingRemote = false;
        });
      } else {
        setState(() { _loadingRemote = false; });
      }
    } catch (e) {
      setState(() { _loadingRemote = false; });
    }
  }

  Future<void> _refresh() async {
    await widget.onRefresh();
    await _fetchRemoteResults();
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = widget.isLoading || _loadingRemote;
    final filteredResults = _remoteResults.where((r) => 
        r.title.toLowerCase().contains(_searchQuery.toLowerCase())).toList();

    return RefreshIndicator(
      color: Colors.orange,
      onRefresh: _refresh,
      child: CustomScrollView(
        slivers: [
          // ── Summary header ───────────────────────────────────────────
          SliverToBoxAdapter(
            child: _ProgressHeader(
              remoteResults: _remoteResults,
              cachedExams: widget.cachedExams,
            ),
          ),

          // ── Section label & Search ───────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
              child: Column(
                children: [
                  Row(
                    children: [
                      const _SectionHeader(
                        icon: Icons.history_rounded,
                        title: 'My Results',
                        color: Colors.orange,
                      ),
                      const Spacer(),
                      Text(
                        'Pull to refresh',
                        style: TextStyle(fontSize: 10, color: Colors.grey.shade400),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    onChanged: (val) => setState(() => _searchQuery = val),
                    decoration: InputDecoration(
                      hintText: 'Search exams by title...',
                      prefixIcon: const Icon(Icons.search, color: Colors.orange),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                    ),
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
                child: Center(child: CircularProgressIndicator(color: Colors.orange)),
              ),
            )
          else if (_remoteResults.isEmpty && widget.cachedExams.isEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 28),
                child: Column(
                  children: [
                    Icon(Icons.assignment_outlined, size: 52, color: Colors.grey.shade300),
                    const SizedBox(height: 12),
                    Text(
                      'No sessions yet',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.grey.shade500),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Scan a QR code from the Dashboard to start your first exam session.',
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade400),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            )
          else if (_remoteResults.isNotEmpty)
            // Live backend results
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, i) => _RemoteResultTile(result: filteredResults[i]),
                childCount: filteredResults.length,
              ),
            )
          else
            // Fallback to SQLite cached exams
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, i) => _SessionTile(exam: widget.cachedExams[i]),
                childCount: widget.cachedExams.length,
              ),
            ),

          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ],
      ),
    );
  }
}

// ── Remote result tile ─────────────────────────────────────────────────────
class _RemoteResultTile extends StatelessWidget {
  const _RemoteResultTile({required this.result});
  final _RemoteResult result;

  bool get _isSubmitted =>
      result.status.toLowerCase() == 'completed' ||
      result.status.toLowerCase() == 'submitted';

  double get _pct => result.totalQuestions == 0
      ? 0
      : result.totalScore / result.totalQuestions;

  Color get _scoreColor {
    if (!_isSubmitted) return Colors.orange;
    return _pct >= 0.5 ? Colors.green : Colors.red;
  }
  
  String get _statusLabel {
    if (!_isSubmitted) return 'In Progress';
    return _pct >= 0.5 ? 'Passed' : 'Failed';
  }

  String get _formattedEndTime {
    final rawDate = result.endTime;
    if (rawDate == null || rawDate.trim().isEmpty) return 'Submitted';

    var normalized = rawDate.trim();
    final hasUtcSuffix = normalized.endsWith(' UTC');
    if (hasUtcSuffix) normalized = normalized.substring(0, normalized.length - 4);
    normalized = normalized.replaceFirst(' ', 'T');
    if (hasUtcSuffix && !normalized.endsWith('Z')) normalized = '${normalized}Z';

    final date = DateTime.tryParse(normalized);
    if (date == null) return rawDate;
    return DateFormat('MMM dd, yyyy • hh:mm a').format(date.toLocal());
  }

  @override
  Widget build(BuildContext context) {
    final pctLabel = result.totalQuestions == 0
        ? '—'
        : '${(_pct * 100).round()}%';

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ExamReviewScreen(
              sessionId: result.sessionGuid,
              subject: result.subject,
              title: result.title,
              score: result.totalScore,
              totalQuestions: result.totalQuestions,
              date: _formattedEndTime,
              questionsJson: result.questionsJson ?? '[]',
              answersJson: result.answersJson ?? '{}',
            ),
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.grey.shade100),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(8),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            SizedBox(
              width: 54,
              height: 54,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CircularProgressIndicator(
                    value: result.totalQuestions == 0 ? 0 : _pct,
                    backgroundColor: _scoreColor.withAlpha(20),
                    valueColor: AlwaysStoppedAnimation<Color>(_scoreColor),
                    strokeWidth: 4.5,
                    strokeCap: StrokeCap.round,
                  ),
                  Center(
                    child: Text(
                      pctLabel,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: _scoreColor,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    result.title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1A1A1A),
                      letterSpacing: -0.2,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          result.subject,
                          style: TextStyle(fontSize: 10, color: Colors.grey.shade600, fontWeight: FontWeight.w600),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(Icons.calendar_today_rounded, size: 10, color: Colors.grey.shade400),
                      const SizedBox(width: 4),
                      Text(
                        _formattedEndTime,
                        style: TextStyle(fontSize: 11, color: Colors.grey.shade500, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${result.totalScore}/${result.totalQuestions}',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _scoreColor.withAlpha(20),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: _scoreColor.withAlpha(50)),
                  ),
                  child: Text(
                    _statusLabel,
                    style: TextStyle(fontSize: 10, color: _scoreColor, fontWeight: FontWeight.w800, letterSpacing: 0.3),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}


class _ProgressHeader extends StatelessWidget {
  const _ProgressHeader({
    required this.remoteResults,
    required this.cachedExams,
  });

  final List<_RemoteResult> remoteResults;
  final List<CachedExam> cachedExams;

  int get _totalSubmitted => remoteResults.isNotEmpty
      ? remoteResults.length
      : cachedExams.where((e) => e.status == 'submitted').length;

  double get _avgScore {
    if (remoteResults.isNotEmpty) {
      final scored = remoteResults.where((r) => r.totalQuestions > 0).toList();
      if (scored.isEmpty) return 0;
      return scored.map((r) => r.totalScore / r.totalQuestions * 100).reduce((a, b) => a + b) / scored.length;
    }
    final scored = cachedExams.where((e) => e.status == 'submitted' && e.totalScore > 0).toList();
    if (scored.isEmpty) return 0;
    return scored.map((e) => e.totalScore.toDouble()).reduce((a, b) => a + b) / scored.length;
  }

  int get _passCount {
    if (remoteResults.isNotEmpty) {
      return remoteResults.where((r) => r.totalQuestions > 0 && r.totalScore / r.totalQuestions >= 0.5).length;
    }
    // For cached exams, calculate actual pass rate based on score
    return cachedExams.where((e) {
      if (e.status != 'submitted') return false;
      int qCount = 0;
      try {
        final questions = jsonDecode(e.questionsJson);
        if (questions is List) qCount = questions.length;
      } catch (_) {}
      return qCount > 0 && e.totalScore / qCount >= 0.5;
    }).length;
  }

  @override
  Widget build(BuildContext context) {
    final avgLabel = remoteResults.isEmpty && cachedExams.isEmpty
        ? '—'
        : '${_avgScore.toStringAsFixed(0)}%';
    final passLabel = _totalSubmitted == 0 ? '—' : '$_passCount/$_totalSubmitted';

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
            'My Results',
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
              _ProgressStat(label: 'Submitted', value: '$_totalSubmitted'),
              const SizedBox(width: 12),
              _ProgressStat(label: 'Avg Score', value: avgLabel),
              const SizedBox(width: 12),
              _ProgressStat(label: 'Passed', value: passLabel),
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

  bool get _isCompleted =>
      exam.status.toLowerCase() == 'submitted' || exam.status.toLowerCase() == 'completed';

  int get _totalQuestions {
    try {
      final questions = jsonDecode(exam.questionsJson);
      return questions is List ? questions.length : 0;
    } catch (_) {
      return 0;
    }
  }

  bool get _isPassed =>
      _isCompleted &&
      (_totalQuestions == 0 ? 0 : exam.totalScore / _totalQuestions) >= 0.5;

  Color get _statusColor {
    if (!_isCompleted) return Colors.orange;
    return _isPassed ? Colors.green : Colors.red;
  }

  String get _statusLabel {
    if (!_isCompleted) return 'In Progress';
    return _isPassed ? 'Passed' : 'Failed';
  }

  IconData get _statusIcon {
    if (!_isCompleted) return Icons.timelapse_rounded;
    return _isPassed ? Icons.check_circle_rounded : Icons.cancel_rounded;
  }

  String get _formattedCreatedAt {
    final date = DateTime.tryParse(exam.createdAt);
    if (date == null) return exam.createdAt;
    return DateFormat('MMM dd, yyyy • hh:mm a').format(date.toLocal());
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: !_isCompleted
          ? null
          : () {
              Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => ExamReviewScreen(
                    sessionId: exam.sessionId,
                    subject: exam.subject,
                    title: exam.subject,
                    score: exam.totalScore,
                    totalQuestions: _totalQuestions,
                    date: _formattedCreatedAt,
                    questionsJson: exam.questionsJson,
                    answersJson: exam.answersJson,
                  ),
                ),
              );
            },
      borderRadius: BorderRadius.circular(14),
      child: Container(
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
                  _formattedCreatedAt,
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
              if (_isCompleted) ...[
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
