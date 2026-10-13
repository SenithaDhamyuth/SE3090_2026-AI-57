import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite/sqflite.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:student_app/screens/exam_review_screen.dart';
import 'package:student_app/screens/exam_timer_screen.dart';
import 'package:student_app/screens/forgot_password_screen.dart';
import 'package:student_app/screens/home_screen.dart';
import 'package:student_app/screens/login_screen.dart';
import 'package:student_app/ui/prep_ui.dart';

// All values in this test are synthetic fixtures. No real service is contacted.
const _questions = [
  {
    'id': 1,
    'text': 'Fixture question one',
    'options': ['Option one', 'Option two'],
    'correctOptionIndex': 0,
  },
  {
    'id': 2,
    'text': 'Fixture question two',
    'options': ['Option three', 'Option four'],
    'correctOptionIndex': 1,
  },
];

final List<List<Object?>> _databaseInsertArguments = [];
final List<List<Object?>> _databaseUpdateArguments = [];

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    databaseFactory = databaseFactorySqflitePlugin;
  });

  setUp(() {
    _databaseInsertArguments.clear();
    _databaseUpdateArguments.clear();
    SharedPreferences.setMockInitialValues({
      'student_name': 'Test Student',
      'student_email': 'student@example.invalid',
      'auth_token': 'test-fixture-only',
    });
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(const MethodChannel('com.tekartik.sqflite'), (
          call,
        ) async {
          switch (call.method) {
            case 'getDatabasesPath':
              return '/tmp/intelliprep-test';
            case 'openDatabase':
              return {'id': 1};
            case 'query':
              final sql = (call.arguments as Map)['sql'] as String;
              if (sql.contains('user_version')) {
                return [
                  {'user_version': 1},
                ];
              }
              return <Map<String, Object?>>[];
            case 'insert':
              final arguments = call.arguments as Map;
              _databaseInsertArguments.add(
                List<Object?>.from(arguments['arguments'] as List),
              );
              return 1;
            case 'update':
              final arguments = call.arguments as Map;
              _databaseUpdateArguments.add(
                List<Object?>.from(arguments['arguments'] as List),
              );
              return 1;
            case 'batch':
              return [];
            default:
              return null;
          }
        });
  });

  Widget app(Widget child, {double scale = 1}) => MaterialApp(
    theme: prepTheme(),
    builder: (context, widget) => MediaQuery(
      data: MediaQuery.of(context)
          .copyWith(textScaler: TextScaler.linear(scale)),
      child: widget!,
    ),
    home: child,
  );

  Future<void> viewport(WidgetTester tester, Size size) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  testWidgets(
    'Dashboard shows real supplied results and no sample statistics',
    (tester) async {
      await viewport(tester, const Size(390, 844));
      await HttpOverrides.runZoned(() async {
        await tester.pumpWidget(app(const HomeScreen()));
        await tester.pumpAndSettle();
        expect(find.text('Hello, Test Student'), findsOneWidget);
        expect(find.text('Scan to join exam'), findsOneWidget);
        expect(find.text('75%'), findsWidgets);
        expect(find.text('68% avg score'), findsNothing);
        expect(find.text('Day 5 of 30'), findsNothing);
        expect(find.text('Data representation'), findsWidgets);
        expect(tester.takeException(), isNull);
        await tester.tap(find.text('Progress').last);
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField), 'no such exam');
        await tester.pumpAndSettle();
        expect(find.text('No matching exams'), findsOneWidget);
        await tester.pumpWidget(const SizedBox());
      }, createHttpClient: (_) => _FixtureClient());
    },
  );

  testWidgets('Dashboard handles failed loads at narrow width and large text', (
    tester,
  ) async {
    await viewport(tester, const Size(320, 640));
    await HttpOverrides.runZoned(() async {
      await tester.pumpWidget(app(const HomeScreen(), scale: 2));
      await tester.pumpAndSettle();
      expect(find.text('Some results are unavailable'), findsOneWidget);
      expect(find.text('Your journey starts here'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    }, createHttpClient: (_) => _FixtureClient(fail: true));
  });

  testWidgets('Login remains scrollable with large text and visible keyboard', (
    tester,
  ) async {
    await viewport(tester, const Size(320, 640));
    tester.view.viewInsets = const FakeViewPadding(bottom: 240);
    addTearDown(tester.view.resetViewInsets);
    await tester.pumpWidget(app(const LoginScreen(), scale: 2));
    await tester.pump();
    await tester.ensureVisible(find.text('Sign in'));
    await tester.tap(find.text('Sign in'));
    await tester.pump();
    expect(find.text('Please enter your email.'), findsOneWidget);
    expect(find.text('Please enter your password.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Password recovery fits a landscape viewport', (tester) async {
    await viewport(tester, const Size(720, 360));
    await tester.pumpWidget(app(const ForgotPasswordScreen(), scale: 1.5));
    await tester.pump();
    await tester.ensureVisible(find.text('Send verification code'));
    expect(tester.takeException(), isNull);
  });

  testWidgets('Exam navigation retains answers and submission reaches review', (
    tester,
  ) async {
    await viewport(tester, const Size(390, 844));
    await HttpOverrides.runZoned(() async {
      await tester.pumpWidget(
        app(const ExamTimerScreen(qrPayload: 'test-session')),
      );
      await tester.pumpAndSettle();
      expect(find.text('Fixture question one'), findsOneWidget);
      expect(
        _databaseInsertArguments
            .expand((arguments) => arguments)
            .whereType<String>()
            .any((value) => value.contains('"correctOptionIndex":0')),
        isTrue,
        reason: 'Offline exam cache must retain correct-answer metadata.',
      );
      await tester.tap(find.text('Option one'));
      await tester.pump();
      await tester.pump();
      expect(
        _databaseUpdateArguments
            .expand((arguments) => arguments)
            .whereType<String>()
            .any((value) => value.contains('"1":0')),
        isTrue,
        reason: 'Selected answers must be saved to the offline exam cache.',
      );
      await tester.tap(find.byTooltip('Next question'));
      await tester.pump();
      expect(find.text('Fixture question two'), findsOneWidget);
      await tester.tap(find.text('Option four'));
      await tester.pump();
      await tester.tap(find.byTooltip('Previous question'));
      await tester.pump();
      final answeredProgress = tester.widget<LinearProgressIndicator>(
        find.byType(LinearProgressIndicator).first,
      );
      expect(answeredProgress.value, 1);
      await tester.tap(find.text('All questions'));
      await tester.pumpAndSettle();
      expect(find.text('1 ✓'), findsOneWidget);
      expect(find.text('2 ✓'), findsOneWidget);
      await tester.tap(find.text('2 ✓'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Submit answers'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Submit').last);
      await tester.pumpAndSettle();
      expect(find.text('Exam complete'), findsOneWidget);
      await tester.tap(find.text('Review my answers'));
      await tester.pumpAndSettle();
      expect(find.text('Exam review'), findsOneWidget);
      expect(find.text('2 / 2'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    }, createHttpClient: (_) => _FixtureClient());
  });

  testWidgets('Review states use text labels and fit large text', (
    tester,
  ) async {
    await viewport(tester, const Size(320, 640));
    await tester.pumpWidget(
      app(
        ExamReviewScreen(
          sessionId: 'test-session',
          subject: 'ICT',
          title: 'Practice paper',
          score: 1,
          totalQuestions: 2,
          date: 'Test date',
          questionsJson: jsonEncode(_questions),
          answersJson: jsonEncode({'1': 1}),
        ),
        scale: 2,
      ),
    );
    await tester.pump();
    expect(find.text('× Your answer'), findsOneWidget);
    expect(find.text('Unanswered'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Legacy cached questions do not invent a correct answer', (
    tester,
  ) async {
    await viewport(tester, const Size(390, 844));
    await tester.pumpWidget(
      app(
        ExamReviewScreen(
          sessionId: 'legacy-session',
          subject: 'ICT',
          title: 'Cached exam',
          score: 1,
          totalQuestions: 1,
          date: 'Test date',
          questionsJson: jsonEncode([
            {
              'id': 1,
              'text': 'Legacy question without answer metadata',
              'options': ['Option A', 'Option B'],
            },
          ]),
          answersJson: jsonEncode({'1': 1}),
        ),
      ),
    );
    await tester.pump();
    expect(find.text('Correct answer not saved'), findsOneWidget);
    expect(find.text('Your answer · correctness unavailable'), findsOneWidget);
    expect(find.text('✓ Correct answer'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

class _FixtureClient implements HttpClient {
  _FixtureClient({this.fail = false});
  final bool fail;
  @override
  Future<HttpClientRequest> openUrl(String method, Uri url) async {
    return _FixtureRequest(url, fail);
  }

  @override
  void close({bool force = false}) {}
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FixtureRequest implements HttpClientRequest {
  _FixtureRequest(this.url, this.fail);
  final Uri url;
  final bool fail;
  @override
  final HttpHeaders headers = _FixtureHeaders();
  @override
  bool followRedirects = true;
  @override
  int maxRedirects = 5;
  @override
  int contentLength = -1;
  @override
  bool persistentConnection = false;
  @override
  Future<void> addStream(Stream<List<int>> stream) async {
    await stream.drain<void>();
  }

  @override
  Future<HttpClientResponse> close() async {
    Object data = {};
    if (url.path.endsWith('/my-results')) {
      data = [
        {
          'sessionGuid': 'fixture',
          'status': 'submitted',
          'subject': 'ICT',
          'title': 'Practice paper',
          'totalScore': 3,
          'totalQuestions': 4,
          'endTime': '2026-01-01T10:00:00Z',
        },
      ];
    } else if (url.path.endsWith('/my-plan')) {
      data = {
        'schedule': [
          {
            'day': 1,
            'topic': 'Data representation',
            'subtopics': 'Binary values',
            'priority': 'High',
          },
        ],
      };
    } else if (url.path.contains('/join/')) {
      data = {'questionsJson': jsonEncode(_questions), 'durationMinutes': 30};
    } else if (url.path.contains('/start/') || url.path.contains('/timer/')) {
      data = {'durationMinutes': 30, 'remainingSeconds': 1800};
    }
    return _FixtureResponse(jsonEncode(data), fail ? 503 : 200);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FixtureHeaders implements HttpHeaders {
  @override
  void set(String name, Object value, {bool preserveHeaderCase = false}) {}
  @override
  void forEach(void Function(String, List<String>) action) {}
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FixtureResponse extends Stream<List<int>> implements HttpClientResponse {
  _FixtureResponse(this.body, this.statusCode);
  final String body;
  @override
  final int statusCode;
  @override
  final HttpHeaders headers = _FixtureHeaders();
  @override
  int get contentLength => utf8.encode(body).length;
  @override
  bool get isRedirect => false;
  @override
  List<RedirectInfo> get redirects => const [];
  @override
  bool get persistentConnection => false;
  @override
  String get reasonPhrase => 'Fixture response';
  @override
  HttpClientResponseCompressionState get compressionState =>
      HttpClientResponseCompressionState.notCompressed;
  @override
  StreamSubscription<List<int>> listen(
    void Function(List<int>)? onData, {
    Function? onError,
    void Function()? onDone,
    bool? cancelOnError,
  }) => Stream.value(utf8.encode(body)).listen(
    onData,
    onError: onError,
    onDone: onDone,
    cancelOnError: cancelOnError,
  );
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
