// test/login_widget_test.dart
//
// Viva demonstration — Widget test for the IntelliPrep LoginScreen.
//
// Pumps the LoginScreen in a completely standalone MaterialApp so no Firebase,
// backend, or platform-channel calls are made. Verifies the presence of the
// key UI elements that the examiner will see on-screen.
//
// Run with:  flutter test test/login_widget_test.dart

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:student_app/screens/login_screen.dart';

void main() {
  /// Wrap the screen in a minimal MaterialApp so that Theme, Navigator,
  /// and MediaQuery are available — exactly what the real app provides.
  Widget buildSubject() => const MaterialApp(
        home: LoginScreen(),
      );

  group('LoginScreen widget tests', () {
    testWidgets('renders the IntelliPrep brand text', (tester) async {
      await tester.pumpWidget(buildSubject());

      // LoginScreen renders a Text('IntelliPrep') inside the hero card.
      expect(find.text('IntelliPrep'), findsOneWidget);
    });

    testWidgets('renders the "Welcome back" heading', (tester) async {
      await tester.pumpWidget(buildSubject());

      expect(find.text('Welcome back'), findsOneWidget);
    });

    testWidgets('renders the email address TextFormField', (tester) async {
      await tester.pumpWidget(buildSubject());

      // The field is identified by its InputDecoration label.
      expect(find.widgetWithText(TextFormField, 'Email address'), findsOneWidget);
    });

    testWidgets('renders the password TextFormField', (tester) async {
      await tester.pumpWidget(buildSubject());

      expect(find.widgetWithText(TextFormField, 'Password'), findsOneWidget);
    });

    testWidgets('renders the "Sign in" FilledButton', (tester) async {
      await tester.pumpWidget(buildSubject());

      // FilledButton contains a child Text('Sign in').
      expect(
        find.widgetWithText(FilledButton, 'Sign in'),
        findsOneWidget,
      );
    });

    testWidgets('renders the "Forgot password?" TextButton', (tester) async {
      await tester.pumpWidget(buildSubject());

      expect(find.text('Forgot password?'), findsOneWidget);
    });

    testWidgets('renders the A/L ICT pill label', (tester) async {
      await tester.pumpWidget(buildSubject());

      // PrepPill renders 'A/L ICT · Student portal' as a Text widget.
      expect(find.text('A/L ICT · Student portal'), findsOneWidget);
    });
  });
}
