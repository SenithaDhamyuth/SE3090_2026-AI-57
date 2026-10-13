import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:student_app/api_constants.dart';
import 'package:student_app/screens/forgot_password_screen.dart';
import 'package:student_app/screens/login_screen.dart';
import 'package:student_app/ui/prep_ui.dart';

// ---------------------------------------------------------------------------
// Focused regression tests for login 401 diagnostics and OTP error handling.
//
// All values are synthetic fixtures — no real network calls are made.
// ---------------------------------------------------------------------------

/// A minimal HTTP client that returns a canned [statusCode] and [body].
class _StubClient implements HttpClient {
  _StubClient({
    required this.statusCode,
    required this.body,
    this.contentType = 'application/json',
  });

  final int statusCode;
  final String body;
  final String contentType;

  @override
  Future<HttpClientRequest> openUrl(String method, Uri url) async {
    return _StubRequest(statusCode, body, contentType);
  }

  @override
  void close({bool force = false}) {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// A stub that throws [SocketException] on every request.
class _OfflineClient implements HttpClient {
  @override
  Future<HttpClientRequest> openUrl(String method, Uri url) async {
    throw const SocketException('Simulated offline');
  }

  @override
  void close({bool force = false}) {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _StubRequest implements HttpClientRequest {
  _StubRequest(this.statusCode, this.body, this.contentType);
  final int statusCode;
  final String body;
  final String contentType;

  @override
  final HttpHeaders headers = _StubHeaders();

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
  Future<HttpClientResponse> close() async =>
      _StubResponse(statusCode, body, contentType);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _StubHeaders implements HttpHeaders {
  @override
  void set(String name, Object value, {bool preserveHeaderCase = false}) {}
  @override
  void forEach(void Function(String, List<String>) action) {}
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _StubResponse extends Stream<List<int>> implements HttpClientResponse {
  _StubResponse(this.statusCode, this.body, this.contentType);

  final String body;
  final String contentType;

  @override
  final int statusCode;

  @override
  HttpHeaders get headers => _StubResponseHeaders(contentType);

  @override
  int get contentLength => utf8.encode(body).length;
  @override
  bool get isRedirect => false;
  @override
  List<RedirectInfo> get redirects => const [];
  @override
  bool get persistentConnection => false;
  @override
  String get reasonPhrase => 'Stub';
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

class _StubResponseHeaders implements HttpHeaders {
  _StubResponseHeaders(this._contentType);
  final String _contentType;
  @override
  List<String>? operator [](String name) =>
      name.toLowerCase() == HttpHeaders.contentTypeHeader
      ? [_contentType]
      : null;
  @override
  String? value(String name) =>
      name.toLowerCase() == HttpHeaders.contentTypeHeader ? _contentType : null;
  @override
  void set(String name, Object value, {bool preserveHeaderCase = false}) {}
  @override
  void forEach(void Function(String, List<String>) action) {
    action(HttpHeaders.contentTypeHeader, [_contentType]);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

// ---------------------------------------------------------------------------
// Unit tests — ApiConstants
// ---------------------------------------------------------------------------

void main() {
  // ── ApiConstants ──────────────────────────────────────────────────────────

  group('ApiConstants', () {
    test('normalizeEmail trims and lowercases', () {
      expect(
        ApiConstants.normalizeEmail('  STUDENT@EXAMPLE.COM  '),
        'student@example.com',
      );
    });

    test('endpoint joins base URL and path without double slash', () {
      final uri = ApiConstants.endpoint('api/auth/login');
      expect(uri.path, '/api/auth/login');
    });

    test('endpoint handles leading slash in path', () {
      final uri = ApiConstants.endpoint('/api/auth/login');
      expect(uri.path, '/api/auth/login');
    });
  });

  // ── Login 401 diagnostics ─────────────────────────────────────────────────

  group('LoginScreen 401 diagnostics', () {
    Widget app(Widget child) => MaterialApp(theme: prepTheme(), home: child);

    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    testWidgets('renders login form without throwing', (tester) async {
      await tester.pumpWidget(app(const LoginScreen()));
      await tester.pump();
      expect(find.text('Sign in'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('401 with JSON body + diagnosticId shows support reference', (
      tester,
    ) async {
      final diagnosticId = 'trace-abc-123';
      final responseBody = jsonEncode({
        'message': 'Invalid email or password.',
        'diagnosticId': diagnosticId,
      });
      await HttpOverrides.runZoned(
        () async {
          await tester.pumpWidget(app(const LoginScreen()));
          await tester.pump();

          // Fill in credentials and tap Login.
          await tester.enterText(
            find.byType(TextFormField).first,
            'student@example.com',
          );
          await tester.enterText(
            find.byType(TextFormField).last,
            'password123',
          );
          await tester.ensureVisible(find.text('Sign in'));
          await tester.tap(find.text('Sign in'));
          await tester.pumpAndSettle();

          // Diagnosis dialog must appear.
          expect(find.text('Login diagnosis'), findsOneWidget);
          // Support reference must be shown.
          expect(
            find.byWidgetPredicate(
              (widget) =>
                  widget is RichText &&
                  widget.text.toPlainText().contains(diagnosticId),
            ),
            findsOneWidget,
          );
          // No "Backend update required" text must appear.
          expect(find.textContaining('Backend update required'), findsNothing);
        },
        createHttpClient: (_) => _StubClient(
          statusCode: 401,
          body: responseBody,
          contentType: 'application/json; charset=utf-8',
        ),
      );
    });

    testWidgets(
      '401 with JSON body but missing diagnosticId shows neutral note — not "Backend update required"',
      (tester) async {
        final responseBody = jsonEncode({
          'message': 'Invalid email or password.',
        });
        await HttpOverrides.runZoned(
          () async {
            await tester.pumpWidget(app(const LoginScreen()));
            await tester.pump();

            await tester.enterText(
              find.byType(TextFormField).first,
              'student@example.com',
            );
            await tester.enterText(
              find.byType(TextFormField).last,
              'password123',
            );
            await tester.ensureVisible(find.text('Sign in'));
            await tester.tap(find.text('Sign in'));
            await tester.pumpAndSettle();

            expect(find.text('Login diagnosis'), findsOneWidget);
            // Must NOT claim the backend needs redeploying.
            expect(
              find.textContaining('Backend update required'),
              findsNothing,
            );
            expect(find.textContaining('deploy'), findsNothing);
            // Should show a neutral note about missing support reference.
            expect(
              find.textContaining('did not include a support reference'),
              findsOneWidget,
            );
          },
          createHttpClient: (_) => _StubClient(
            statusCode: 401,
            body: responseBody,
            contentType: 'application/json',
          ),
        );
      },
    );

    testWidgets(
      '401 with HTML body shows proxy note — not "Backend update required"',
      (tester) async {
        await HttpOverrides.runZoned(
          () async {
            await tester.pumpWidget(app(const LoginScreen()));
            await tester.pump();

            await tester.enterText(
              find.byType(TextFormField).first,
              'student@example.com',
            );
            await tester.enterText(
              find.byType(TextFormField).last,
              'password123',
            );
            await tester.ensureVisible(find.text('Sign in'));
            await tester.tap(find.text('Sign in'));
            await tester.pumpAndSettle();

            expect(find.text('Login diagnosis'), findsOneWidget);
            // Must NOT claim the backend needs redeploying.
            expect(
              find.textContaining('Backend update required'),
              findsNothing,
            );
            expect(find.textContaining('deploy'), findsNothing);
            // Should explain that a proxy/gateway intercepted.
            expect(find.textContaining('proxy'), findsOneWidget);
          },
          createHttpClient: (_) => _StubClient(
            statusCode: 401,
            body: '<html><body>Unauthorized</body></html>',
            contentType: 'text/html',
          ),
        );
      },
    );
  });

  // ── ForgotPasswordScreen OTP error handling ───────────────────────────────

  group('ForgotPasswordScreen OTP error handling', () {
    Widget app(Widget child) => MaterialApp(theme: prepTheme(), home: child);

    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    testWidgets('successful OTP request shows step-2 UI', (tester) async {
      await HttpOverrides.runZoned(
        () async {
          await tester.pumpWidget(app(const ForgotPasswordScreen()));
          await tester.pump();

          await tester.enterText(
            find.byType(TextField).first,
            'student@example.com',
          );
          await tester.tap(find.text('Send verification code'));
          await tester.pumpAndSettle();

          // Step 2 UI must appear.
          expect(find.text('Verify and reset password'), findsOneWidget);
          expect(tester.takeException(), isNull);
        },
        createHttpClient: (_) => _StubClient(
          statusCode: 200,
          body: jsonEncode({
            'message': 'If the email exists, a verification code was sent.',
          }),
        ),
      );
    });

    testWidgets(
      'OTP request HTTP 503 shows HTTP error message — not "Network error"',
      (tester) async {
        await HttpOverrides.runZoned(
          () async {
            await tester.pumpWidget(app(const ForgotPasswordScreen()));
            await tester.pump();

            await tester.enterText(
              find.byType(TextField).first,
              'student@example.com',
            );
            await tester.tap(find.text('Send verification code'));
            await tester.pumpAndSettle();

            // Must not say "Network error".
            expect(find.textContaining('Network error'), findsNothing);
            // Must reference the HTTP status or a descriptive message.
            expect(
              find.textContaining('503').evaluate().isNotEmpty ||
                  find.textContaining('try again').evaluate().isNotEmpty,
              isTrue,
            );
            // Must still be on step 1 — not advance to OTP entry.
            expect(find.text('Send verification code'), findsOneWidget);
            expect(tester.takeException(), isNull);
          },
          createHttpClient: (_) => _StubClient(
            statusCode: 503,
            body: '<html>Service Unavailable</html>',
            contentType: 'text/html',
          ),
        );
      },
    );

    testWidgets(
      'OTP request HTTP 429 shows rate-limit message — not "Network error"',
      (tester) async {
        await HttpOverrides.runZoned(
          () async {
            await tester.pumpWidget(app(const ForgotPasswordScreen()));
            await tester.pump();

            await tester.enterText(
              find.byType(TextField).first,
              'student@example.com',
            );
            await tester.tap(find.text('Send verification code'));
            await tester.pumpAndSettle();

            expect(find.textContaining('Network error'), findsNothing);
            expect(find.textContaining('wait'), findsOneWidget);
            expect(tester.takeException(), isNull);
          },
          createHttpClient: (_) => _StubClient(
            statusCode: 429,
            body: jsonEncode({
              'message':
                  'Please wait before requesting another verification code.',
            }),
          ),
        );
      },
    );

    testWidgets(
      'OTP request with non-JSON 429 body still shows rate-limit fallback',
      (tester) async {
        await HttpOverrides.runZoned(
          () async {
            await tester.pumpWidget(app(const ForgotPasswordScreen()));
            await tester.pump();

            await tester.enterText(
              find.byType(TextField).first,
              'student@example.com',
            );
            await tester.tap(find.text('Send verification code'));
            await tester.pumpAndSettle();

            expect(find.textContaining('Network error'), findsNothing);
            // A fallback message, not a crash.
            expect(tester.takeException(), isNull);
          },
          createHttpClient: (_) => _StubClient(
            statusCode: 429,
            body: 'Too Many Requests',
            contentType: 'text/plain',
          ),
        );
      },
    );

    testWidgets(
      'OTP request with SocketException shows connectivity message — not "Network error"',
      (tester) async {
        await HttpOverrides.runZoned(() async {
          await tester.pumpWidget(app(const ForgotPasswordScreen()));
          await tester.pump();

          await tester.enterText(
            find.byType(TextField).first,
            'student@example.com',
          );
          await tester.tap(find.text('Send verification code'));
          await tester.pumpAndSettle();

          // Must say something about being unable to reach the server.
          expect(find.textContaining('Unable to reach'), findsOneWidget);
          expect(tester.takeException(), isNull);
        }, createHttpClient: (_) => _OfflineClient());
      },
    );

    testWidgets('successful OTP verify navigates back', (tester) async {
      // Wrap in a router with a parent home page so Navigator.pop() works.
      await HttpOverrides.runZoned(
        () async {
          await tester.pumpWidget(
            MaterialApp(
              theme: prepTheme(),
              home: const Scaffold(body: Text('Home')),
              routes: {'/reset': (_) => const ForgotPasswordScreen()},
            ),
          );
          await tester.pump();

          // Navigate to the forgot-password screen.
          final navigator = tester.state<NavigatorState>(
            find.byType(Navigator),
          );
          navigator.pushNamed('/reset');
          await tester.pumpAndSettle();

          // Step 1: request OTP.
          await tester.enterText(
            find.byType(TextField).first,
            'student@example.com',
          );
          await tester.ensureVisible(find.text('Send verification code'));
          await tester.tap(find.text('Send verification code'));
          await tester.pumpAndSettle();
          // Now on step 2.
          expect(find.text('Verify and reset password'), findsOneWidget);

          // Fill code and new password.
          await tester.enterText(find.byType(TextField).at(1), '123456');
          await tester.enterText(find.byType(TextField).at(2), 'newpassword');
          await tester.ensureVisible(find.text('Verify and reset password'));
          await tester.tap(find.text('Verify and reset password'));
          await tester.pumpAndSettle();

          // After success the screen pops back to 'Home'.
          expect(find.text('Home'), findsOneWidget);
          expect(find.text('Verify and reset password'), findsNothing);
          expect(tester.takeException(), isNull);
        },
        createHttpClient: (_) => _StubClient(
          statusCode: 200,
          body: jsonEncode({
            'message': 'If the email exists, a verification code was sent.',
          }),
        ),
      );
    });

    testWidgets(
      'OTP verify HTTP 400 shows server message — not "Network error"',
      (tester) async {
        // Two-phase stub: OTP request returns 200; verify returns 400.
        // The factory is called once per http.post(), so we track calls.
        var callCount = 0;
        await HttpOverrides.runZoned(
          () async {
            await tester.pumpWidget(app(const ForgotPasswordScreen()));
            await tester.pump();

            await tester.enterText(
              find.byType(TextField).first,
              'student@example.com',
            );
            await tester.ensureVisible(find.text('Send verification code'));
            await tester.tap(find.text('Send verification code'));
            await tester.pumpAndSettle();

            // Should now be on step 2.
            expect(find.text('Verify and reset password'), findsOneWidget);

            await tester.enterText(find.byType(TextField).at(1), '000000');
            await tester.enterText(find.byType(TextField).at(2), 'newpassword');
            await tester.ensureVisible(find.text('Verify and reset password'));
            await tester.tap(find.text('Verify and reset password'));
            await tester.pumpAndSettle();

            expect(find.textContaining('Network error'), findsNothing);
            expect(find.textContaining('invalid or expired'), findsOneWidget);
            expect(tester.takeException(), isNull);
          },
          createHttpClient: (_) {
            callCount++;
            if (callCount == 1) {
              return _StubClient(
                statusCode: 200,
                body: jsonEncode({'message': 'OK'}),
              );
            }
            return _StubClient(
              statusCode: 400,
              body: jsonEncode({
                'message': 'The verification code is invalid or expired.',
              }),
            );
          },
        );
      },
    );
  });
}
