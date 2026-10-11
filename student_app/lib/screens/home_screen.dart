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
import '../ui/prep_ui.dart';

/// HomeScreen — main shell of the IntelliPrep Student App.
///
/// Hosts a [NavigationBar] with three tabs:
///   • Tab 0 — Dashboard  : welcome, exam entry, progress, published study plan
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
  String _studentEmail = '';
  String _studentName = '';
  String? _cacheError;
  final _planKey = GlobalKey<_StudyPlanTabState>();
  final _progressKey = GlobalKey<_ProgressTabState>();
  List<_StudyDay> _dashboardPlan = [];
  List<_RemoteResult> _dashboardResults = [];
  bool _planLoading = true;
  bool _resultsLoading = true;
  String? _planError;
  String? _resultsError;

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
      _studentEmail = prefs.getString('student_email') ?? '';
      _studentName = prefs.getString('student_name') ?? '';
    });
  }

  Future<void> _loadCachedExams() async {
    if (!mounted) return;
    setState(() {
      _loadingExams = true;
      _cacheError = null;
    });
    try {
      final exams = await DatabaseHelper.instance.getAllExams();
      if (mounted) setState(() => _cachedExams = exams);
    } catch (_) {
      if (mounted) {
        setState(
          () => _cacheError = 'Could not read saved exams on this device.',
        );
      }
    } finally {
      if (mounted) setState(() => _loadingExams = false);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────

  void _openQRScanner() {
    Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => const QRScannerScreen()))
        .then((_) => _refreshHome());
  }

  void _openProfile() {
    Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => const ProfileScreen()))
        .then((_) => _loadStudentInfo());
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Sign out?',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        content: const Text('You will be returned to the login screen.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: PrepColors.primary),
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

  void _receivePlan(List<_StudyDay> plan, bool loading, String? error) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() {
        _dashboardPlan = plan;
        _planLoading = loading;
        _planError = error;
      });
    });
  }

  void _receiveResults(
    List<_RemoteResult> results,
    bool loading,
    String? error,
  ) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() {
        _dashboardResults = results;
        _resultsLoading = loading;
        _resultsError = error;
      });
    });
  }

  Future<void> _refreshHome() async {
    if (!mounted) return;
    await Future.wait([
      _loadStudentInfo(),
      _loadCachedExams(),
      if (_planKey.currentState != null) _planKey.currentState!._refresh(),
      if (_progressKey.currentState != null)
        _progressKey.currentState!._fetchRemoteResults(),
    ]);
  }

  List<Widget> get _tabs => [
    _DashboardTab(
      name: _studentName,
      email: _studentEmail,
      onScanQR: _openQRScanner,
      onProfile: _openProfile,
      onStudyPlan: () => setState(() => _currentIndex = 1),
      onProgress: () => setState(() => _currentIndex = 2),
      onRefresh: _refreshHome,
      cachedExams: _cachedExams,
      results: _dashboardResults,
      loading: _loadingExams || _resultsLoading,
      error: _resultsError ?? _cacheError,
      plan: _dashboardPlan,
      planLoading: _planLoading,
      planError: _planError,
    ),
    _StudyPlanTab(key: _planKey, onChanged: _receivePlan),
    _ProgressTab(
      key: _progressKey,
      cachedExams: _cachedExams,
      isLoading: _loadingExams,
      onRefresh: _loadCachedExams,
      onChanged: _receiveResults,
      cacheError: _cacheError,
    ),
  ];

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: _buildAppBar(),
    body: IndexedStack(index: _currentIndex, children: _tabs),
    bottomNavigationBar: NavigationBar(
      selectedIndex: _currentIndex,
      onDestinationSelected: (i) => setState(() => _currentIndex = i),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          selectedIcon: Icon(Icons.home_rounded),
          label: 'Dashboard',
        ),
        NavigationDestination(
          icon: Icon(Icons.auto_stories_outlined),
          selectedIcon: Icon(Icons.auto_stories_rounded),
          label: 'Study Plan',
        ),
        NavigationDestination(
          icon: Icon(Icons.insights_outlined),
          selectedIcon: Icon(Icons.insights_rounded),
          label: 'Progress',
        ),
      ],
    ),
  );

  PreferredSizeWidget _buildAppBar() {
    const titles = ['IntelliPrep', 'Study Plan', 'Progress'];
    return AppBar(
      title: Text(
        titles[_currentIndex],
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      actions: [
        IconButton(
          tooltip: 'My profile',
          onPressed: _openProfile,
          icon: const Icon(Icons.account_circle_outlined),
        ),
        IconButton(
          tooltip: 'Sign out',
          onPressed: _logout,
          icon: const Icon(Icons.logout_rounded),
        ),
        const SizedBox(width: 8),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 0 — DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

class _DashboardTab extends StatelessWidget {
  const _DashboardTab({
    required this.name,
    required this.email,
    required this.onScanQR,
    required this.onProfile,
    required this.onStudyPlan,
    required this.onProgress,
    required this.onRefresh,
    required this.cachedExams,
    required this.results,
    required this.loading,
    required this.error,
    required this.plan,
    required this.planLoading,
    required this.planError,
  });
  final String name;
  final String email;
  final VoidCallback onScanQR;
  final VoidCallback onProfile;
  final VoidCallback onStudyPlan;
  final VoidCallback onProgress;
  final Future<void> Function() onRefresh;
  final List<CachedExam> cachedExams;
  final List<_RemoteResult> results;
  final bool loading;
  final String? error;
  final List<_StudyDay> plan;
  final bool planLoading;
  final String? planError;

  List<_RemoteResult> get _recentResults {
    DateTime timeOf(_RemoteResult result) {
      var value = (result.endTime ?? '').trim();
      final utc = value.endsWith(' UTC');
      if (utc) value = value.substring(0, value.length - 4);
      value = value.replaceFirst(' ', 'T');
      if (utc && !value.endsWith('Z')) value += 'Z';
      return DateTime.tryParse(value) ?? DateTime.fromMillisecondsSinceEpoch(0);
    }

    return [...results]..sort((a, b) => timeOf(b).compareTo(timeOf(a)));
  }

  @override
  Widget build(BuildContext context) => PrepPage(
    onRefresh: onRefresh,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _WelcomeBanner(
          firstName: name.trim().isNotEmpty ? name.trim() : email.trim(),
        ),
        const SizedBox(height: 24),
        PrepCard(
          color: PrepColors.navy,
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.qr_code_scanner_rounded,
                color: Color(0xFFBDEBD8),
                size: 36,
              ),
              const SizedBox(height: 24),
              Text(
                'Your next exam\nstarts here.',
                style: Theme.of(context).textTheme.headlineMedium
                    ?.copyWith(color: Colors.white),
              ),
              const SizedBox(height: 10),
              const Text(
                'Scan the code from your tutor to join your exam.',
                style: TextStyle(
                  color: Color(0xFFDBEBEF),
                  fontSize: 15,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: onScanQR,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFD7F2B8),
                    foregroundColor: PrepColors.navy,
                  ),
                  icon: const Icon(Icons.qr_code_scanner_rounded),
                  label: const Text('Scan to join exam'),
                ),
              ),
            ],
          ),
        ),
        PrepSection(
          title: 'Your learning snapshot',
          action: 'View progress',
          onAction: onProgress,
        ),
        if (loading)
          const PrepState(title: 'Loading your progress', loading: true)
        else ...[
          if (error != null) ...[
            PrepState(
              title: 'Some results are unavailable',
              message: error,
              icon: Icons.cloud_off_outlined,
              action: 'Try again',
              onAction: onRefresh,
            ),
            const SizedBox(height: 12),
          ],
          _ProgressHeader(remoteResults: results, cachedExams: cachedExams),
        ],
        const PrepSection(title: 'Continue learning'),
        if (planLoading)
          const PrepState(title: 'Checking your study plan', loading: true)
        else if (plan.isNotEmpty && planError == null)
          _NextTaskCard(day: plan.first, onTap: onStudyPlan)
        else
          PrepAction(
            title: 'Study plan',
            subtitle: planError == null
                ? 'View your published study schedule.'
                : 'Check your plan’s availability.',
            icon: Icons.menu_book_outlined,
            onTap: onStudyPlan,
          ),
        PrepSection(
          title: 'Recent exams',
          action: 'See all',
          onAction: onProgress,
        ),
        if (loading)
          const PrepState(title: 'Loading exam history', loading: true)
        else if (results.isEmpty && cachedExams.isEmpty)
          const PrepState(
            title: 'Your journey starts here',
            message: 'After your first exam, your results will appear here.',
            icon: Icons.assignment_outlined,
          )
        else if (results.isNotEmpty)
          ..._recentResults
              .take(3)
              .map(
                (r) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _RemoteResultTile(result: r),
                ),
              )
        else
          ...cachedExams
              .take(3)
              .map(
                (e) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _SessionTile(exam: e),
                ),
              ),
        const PrepSection(title: 'Your account'),
        PrepAction(
          title: 'My profile',
          subtitle: 'Manage your details and profile photo.',
          icon: Icons.person_outline_rounded,
          onTap: onProfile,
        ),
      ],
    ),
  );
}

class _WelcomeBanner extends StatelessWidget {
  const _WelcomeBanner({required this.firstName});
  final String firstName;
  @override
  Widget build(BuildContext context) => PrepHeading(
    eyebrow: 'A/L ICT · INTELLIPREP',
    title: firstName.isEmpty ? 'Welcome back' : 'Hello, $firstName',
    subtitle: 'A little progress, every day.',
  );
}

class _NextTaskCard extends StatelessWidget {
  const _NextTaskCard({required this.day, required this.onTap});
  final _StudyDay day;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => PrepCard(
    onTap: onTap,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            PrepPill('Day ${day.day}', icon: Icons.menu_book_outlined),
            PrepPill(
              '${day.priority} priority',
              background: const Color(0xFFFFF2DE),
              color: PrepColors.amber,
            ),
          ],
        ),
        const SizedBox(height: 16),
        Text(day.topic, style: Theme.of(context).textTheme.titleLarge),
        if (day.subtopics.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(day.subtopics),
        ],
        const SizedBox(height: 16),
        const Text(
          'From your published plan · View plan →',
          style: TextStyle(
            color: PrepColors.primary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

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
  const _StudyPlanTab({super.key, required this.onChanged});
  final void Function(List<_StudyDay>, bool, String?) onChanged;

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
    widget.onChanged(_plan, true, null);
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? '';
      final url = ApiConstants.endpoint('api/student/my-plan');
      final response = await http.get(
        url,
        headers: {'Authorization': 'Bearer $token'},
      );

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
      if (mounted) {
        setState(() => _isLoading = false);
        widget.onChanged(_plan, _isLoading, _errorMsg);
      }
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
  Widget build(BuildContext context) => PrepPage(
    onRefresh: _refresh,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const PrepHeading(
          eyebrow: 'YOUR LEARNING PATH',
          title: 'One topic at a time',
          subtitle: 'Your published study schedule, ready when you are.',
        ),
        const SizedBox(height: 24),
        if (_isLoading)
          const PrepState(title: 'Loading your study plan', loading: true)
        else if (_errorMsg != null)
          PrepState(
            title: _errorMsg!.contains('publish')
                ? 'Your plan is on its way'
                : 'Could not load your plan',
            message: _errorMsg,
            icon: _errorMsg!.contains('publish')
                ? Icons.hourglass_empty_rounded
                : Icons.cloud_off_outlined,
            action: 'Refresh',
            onAction: _refresh,
          )
        else if (_plan.isEmpty)
          PrepState(
            title: 'No study days yet',
            message: 'Your study topics will appear here when available.',
            action: 'Refresh',
            onAction: _refresh,
          )
        else ...[
          PrepPill(
            '${_plan.length} study days',
            icon: Icons.calendar_month_outlined,
          ),
          const SizedBox(height: 16),
          ...List.generate(
            _plan.length,
            (i) => _StudyDayTile(
              day: _plan[i],
              dayNumber: i + 1,
              isLast: i == _plan.length - 1,
            ),
          ),
        ],
      ],
    ),
  );
}

class _StudyDayTile extends StatelessWidget {
  const _StudyDayTile({
    required this.day,
    required this.dayNumber,
    required this.isLast,
  });
  final _StudyDay day;
  final int dayNumber;
  final bool isLast;
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
    child: PrepCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              PrepPill('Day $dayNumber', icon: Icons.menu_book_outlined),
              PrepPill(
                '${day.priority} priority',
                color: PrepColors.amber,
                background: const Color(0xFFFFF2DE),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(day.topic, style: Theme.of(context).textTheme.titleLarge),
          if (day.subtopics.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(day.subtopics),
          ],
        ],
      ),
    ),
  );
}

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
    final subject =
        (json['subject'] ??
                json['Subject'] ??
                json['title'] ??
                json['Title'] ??
                'Exam')
            .toString();
    return _RemoteResult(
      sessionGuid: (json['sessionGuid'] ?? json['SessionGuid'] ?? '')
          .toString(),
      status: (json['status'] ?? json['Status'] ?? '').toString(),
      subject: subject,
      title:
          (json['title'] ??
                  json['Title'] ??
                  json['subject'] ??
                  json['Subject'] ??
                  'Exam')
              .toString(),
      totalScore: _readInt(json['totalScore'] ?? json['TotalScore']),
      totalQuestions: _readInt(
        json['totalQuestions'] ?? json['TotalQuestions'],
      ),
      endTime: (json['endTime'] ?? json['EndTime'])?.toString(),
      durationMinutes: _readInt(
        json['durationMinutes'] ?? json['DurationMinutes'],
        30,
      ),
      questionsJson: (json['questionsJson'] ?? json['QuestionsJson'])
          ?.toString(),
      answersJson: (json['answersJson'] ?? json['AnswersJson'])?.toString(),
    );
  }

  static int _readInt(dynamic value, [int fallback = 0]) =>
      value is num ? value.toInt() : int.tryParse('$value') ?? fallback;
}

class _ProgressTab extends StatefulWidget {
  const _ProgressTab({
    super.key,
    required this.onChanged,
    this.cacheError,
    required this.cachedExams,
    required this.isLoading,
    required this.onRefresh,
  });

  final List<CachedExam> cachedExams;
  final bool isLoading;
  final Future<void> Function() onRefresh;
  final String? cacheError;
  final void Function(List<_RemoteResult>, bool, String?) onChanged;

  @override
  State<_ProgressTab> createState() => _ProgressTabState();
}

class _ProgressTabState extends State<_ProgressTab> {
  List<_RemoteResult> _remoteResults = [];
  bool _loadingRemote = true;
  String? _remoteError;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _fetchRemoteResults();
  }

  Future<void> _fetchRemoteResults() async {
    if (!mounted) return;
    setState(() {
      _loadingRemote = true;
      _remoteError = null;
    });
    widget.onChanged(_remoteResults, true, null);
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? '';
      if (!mounted) return;
      if (token.isEmpty) {
        setState(() {
          _loadingRemote = false;
          _remoteError = 'Sign in to see your latest results.';
        });
        return;
      }
      final url = ApiConstants.endpoint('api/student/my-results');
      final response = await http
          .get(
            url,
            headers: {
              'Authorization': 'Bearer $token',
              'Accept': 'application/json',
            },
          )
          .timeout(const Duration(seconds: 10));
      if (!mounted) return;

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        final dynamic rawResults = decoded is List
            ? decoded
            : decoded is Map
            ? decoded['results'] ??
                  decoded['Results'] ??
                  decoded['data'] ??
                  decoded['Data']
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
        setState(() {
          _loadingRemote = false;
          _remoteError = 'Could not refresh your results. Saved exams are still available.';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loadingRemote = false;
          _remoteError = 'Check your connection and try again. Saved exams are still available.';
        });
      }
    } finally {
      if (mounted) {
        widget.onChanged(_remoteResults, _loadingRemote, _remoteError);
      }
    }
  }

  Future<void> _refresh() async {
    await widget.onRefresh();
    await _fetchRemoteResults();
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = widget.isLoading || _loadingRemote;
    final filteredResults = _remoteResults
        .where(
          (r) => r.title.toLowerCase().contains(_searchQuery.toLowerCase()),
        )
        .toList();
    final filteredCached = widget.cachedExams
        .where(
          (e) => e.subject.toLowerCase().contains(_searchQuery.toLowerCase()),
        )
        .toList();
    final error = _remoteError ?? widget.cacheError;
    return PrepPage(
      onRefresh: _refresh,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const PrepHeading(
            eyebrow: 'LOOK HOW FAR YOU’VE COME',
            title: 'Your progress',
            subtitle:
                'Review your exams and find your next learning opportunity.',
          ),
          const SizedBox(height: 24),
          if (isLoading)
            const PrepState(title: 'Loading your results', loading: true)
          else ...[
            if (error != null) ...[
              PrepState(
                title: 'Results could not refresh',
                message: error,
                icon: Icons.cloud_off_outlined,
                action: 'Try again',
                onAction: _refresh,
              ),
              const SizedBox(height: 16),
            ],
            _ProgressHeader(
              remoteResults: _remoteResults,
              cachedExams: widget.cachedExams,
            ),
          ],
          const PrepSection(title: 'Exam history'),
          TextField(
            onChanged: (value) => setState(() => _searchQuery = value),
            textInputAction: TextInputAction.search,
            decoration: const InputDecoration(
              labelText: 'Search exams',
              hintText: 'Search by exam title',
              prefixIcon: Icon(Icons.search_rounded),
            ),
          ),
          const SizedBox(height: 16),
          if (!isLoading)
            if (_remoteResults.isEmpty && widget.cachedExams.isEmpty)
              const PrepState(
                title: 'No exams yet',
                message: 'Scan your tutor’s QR code from the Dashboard to get started.',
              )
            else if ((_remoteResults.isNotEmpty && filteredResults.isEmpty) ||
                (_remoteResults.isEmpty && filteredCached.isEmpty))
              const PrepState(
                title: 'No matching exams',
                message: 'Try another exam title.',
                icon: Icons.search_off_rounded,
              )
            else if (_remoteResults.isNotEmpty)
              ...filteredResults.map(
                (r) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _RemoteResultTile(result: r),
                ),
              )
            else ...[
              const PrepPill(
                'Saved on this device',
                icon: Icons.offline_pin_outlined,
              ),
              const SizedBox(height: 12),
              ...filteredCached.map(
                (e) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _SessionTile(exam: e),
                ),
              ),
            ],
        ],
      ),
    );
  }
}

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
    if (!_isSubmitted) return PrepColors.primary;
    return _pct >= 0.5 ? PrepColors.primary : PrepColors.error;
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
    if (hasUtcSuffix) {
      normalized = normalized.substring(0, normalized.length - 4);
    }
    normalized = normalized.replaceFirst(' ', 'T');
    if (hasUtcSuffix && !normalized.endsWith('Z')) {
      normalized = '${normalized}Z';
    }

    final date = DateTime.tryParse(normalized);
    if (date == null) return rawDate;
    return DateFormat('MMM dd, yyyy • hh:mm a').format(date.toLocal());
  }

  @override
  Widget build(BuildContext context) => _ExamHistoryCard(
    title: result.title,
    subject: result.subject,
    date: _formattedEndTime,
    score: result.totalQuestions == 0
        ? 'Score unavailable'
        : '${result.totalScore}/${result.totalQuestions} · ${(_pct * 100).round()}%',
    status: _statusLabel,
    color: _scoreColor,
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
  );
}

class _ProgressHeader extends StatelessWidget {
  const _ProgressHeader({
    required this.remoteResults,
    required this.cachedExams,
  });
  final List<_RemoteResult> remoteResults;
  final List<CachedExam> cachedExams;

  @override
  Widget build(BuildContext context) {
    // Presentation-only summary of completed records. Never manufacture scores.
    final percentages = <double>[];
    var completed = 0;
    var total = 0;
    if (remoteResults.isNotEmpty) {
      total = remoteResults.length;
      for (final result in remoteResults) {
        final status = result.status.toLowerCase();
        if (status != 'submitted' && status != 'completed') continue;
        completed++;
        if (result.totalQuestions > 0) {
          percentages.add(result.totalScore / result.totalQuestions * 100);
        }
      }
    } else {
      total = cachedExams.length;
      for (final exam in cachedExams) {
        final status = exam.status.toLowerCase();
        if (status != 'submitted' && status != 'completed') continue;
        completed++;
        try {
          final questions = jsonDecode(exam.questionsJson);
          if (questions is List && questions.isNotEmpty) {
            percentages.add(exam.totalScore / questions.length * 100);
          }
        } catch (_) {
          /* Missing question data is shown without a percentage. */
        }
      }
    }
    final average = percentages.isEmpty
        ? '—'
        : '${(percentages.reduce((a, b) => a + b) / percentages.length).round()}%';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PrepMetrics(
          items: [
            PrepMetric(
              label: 'Completed exams',
              value: '$completed',
              icon: Icons.task_alt_rounded,
            ),
            PrepMetric(
              label: 'Average score',
              value: average,
              icon: Icons.insights_rounded,
            ),
            PrepMetric(
              label: 'Total sessions',
              value: '$total',
              icon: Icons.history_rounded,
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          remoteResults.isNotEmpty
              ? 'Based on your available exam results.'
              : 'Based on exams saved on this device.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _ExamHistoryCard extends StatelessWidget {
  const _ExamHistoryCard({
    required this.title,
    required this.subject,
    required this.date,
    required this.score,
    required this.status,
    required this.color,
    this.onTap,
    this.icon = Icons.assignment_outlined,
  });
  final String title;
  final String subject;
  final String date;
  final String score;
  final String status;
  final Color color;
  final VoidCallback? onTap;
  final IconData icon;
  @override
  Widget build(BuildContext context) => PrepCard(
    onTap: onTap,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 10,
          runSpacing: 8,
          children: [
            PrepPill(
              status,
              icon: icon,
              color: color,
              background: color.withAlpha(20),
            ),
            PrepPill(
              score,
              icon: Icons.analytics_outlined,
              color: PrepColors.ink,
              background: PrepColors.canvas,
            ),
          ],
        ),
        const SizedBox(height: 14),
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 6),
        if (subject != title) ...[Text(subject), const SizedBox(height: 6)],
        Text(date, style: Theme.of(context).textTheme.bodySmall),
        if (onTap != null) ...[
          const SizedBox(height: 14),
          const Text(
            'Review answers →',
            style: TextStyle(
              color: PrepColors.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ],
    ),
  );
}

class _SessionTile extends StatelessWidget {
  const _SessionTile({required this.exam});

  final CachedExam exam;

  bool get _isCompleted =>
      exam.status.toLowerCase() == 'submitted' ||
      exam.status.toLowerCase() == 'completed';

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
    if (!_isCompleted) return PrepColors.primary;
    return _isPassed ? PrepColors.primary : PrepColors.error;
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
  Widget build(BuildContext context) => _ExamHistoryCard(
    title: exam.subject,
    subject: exam.subject,
    date: _formattedCreatedAt,
    score: _isCompleted
        ? '${exam.totalScore}/$_totalQuestions'
        : 'Not submitted',
    status: _statusLabel,
    color: _statusColor,
    icon: _statusIcon,
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
  );
}
