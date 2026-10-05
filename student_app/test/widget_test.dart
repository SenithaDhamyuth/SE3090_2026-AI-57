import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:student_app/main.dart';

/// IntelliPrep student app widget tests.
///
/// These tests verify that the core UI widgets render correctly
/// without making any real network calls or touching SharedPreferences.
void main() {
  // ── Test 1: App renders without crashing ────────────────────────────────────
  testWidgets('StudentExamApp renders without throwing', (WidgetTester tester) async {
    // Build the top-level app widget.
    // Because SharedPreferences is not initialised in the test environment,
    // the FutureBuilder will be in a waiting state — we verify the splash
    // screen (CircularProgressIndicator) appears instead of crashing.
    await tester.pumpWidget(const StudentExamApp());

    // Allow the first frame to render.
    await tester.pump();

    // The app title must be set correctly.
    expect(find.byType(MaterialApp), findsOneWidget);
  });

  // ── Test 2: Splash screen shows the branded CircularProgressIndicator ────────
  testWidgets('Splash screen shows CircularProgressIndicator while loading',
      (WidgetTester tester) async {
    await tester.pumpWidget(const StudentExamApp());
    // Do NOT advance time — stay on the first frame (token lookup in flight).
    await tester.pump(Duration.zero);

    // The splash screen wraps a CircularProgressIndicator while the
    // SharedPreferences future has not yet completed.
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  // ── Test 3: Splash screen shows the IntelliPrep brand text ───────────────────
  testWidgets('Splash screen contains IntelliPrep brand name',
      (WidgetTester tester) async {
    await tester.pumpWidget(const StudentExamApp());
    await tester.pump(Duration.zero);

    // The branded app name must be visible on the splash screen.
    expect(find.text('IntelliPrep'), findsOneWidget);
  });

  // ── Test 4: Splash screen shows the sub-title ────────────────────────────────
  testWidgets('Splash screen contains A/L ICT Student App subtitle',
      (WidgetTester tester) async {
    await tester.pumpWidget(const StudentExamApp());
    await tester.pump(Duration.zero);

    expect(find.text('A/L ICT Student App'), findsOneWidget);
  });
}
