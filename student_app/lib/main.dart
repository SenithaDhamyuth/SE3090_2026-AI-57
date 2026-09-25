import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

void main() {
  runApp(const StudentExamApp());
}

class StudentExamApp extends StatelessWidget {
  const StudentExamApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'IntelliPrep Student',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.orange,
        fontFamily: 'Roboto',
      ),
      // FutureBuilder checks SharedPreferences for a saved token on startup.
      // If a token exists → HomeScreen; otherwise → LoginScreen.
      home: FutureBuilder<bool>(
        future: _hasValidToken(),
        builder: (context, snapshot) {
          // Show a branded splash while waiting for the preference read.
          if (!snapshot.hasData) {
            return const _SplashScreen();
          }

          return snapshot.data! ? const HomeScreen() : const LoginScreen();
        },
      ),
    );
  }
}

/// Reads SharedPreferences and returns [true] if a non-empty auth_token exists.
Future<bool> _hasValidToken() async {
  final prefs = await SharedPreferences.getInstance();
  final token = prefs.getString('auth_token') ?? '';
  return token.isNotEmpty;
}

// ── Splash screen shown while the token check is in-flight ─────────────────

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.orange,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: Colors.white.withAlpha(40),
                borderRadius: BorderRadius.circular(24),
              ),
              child: const Icon(
                Icons.school_rounded,
                color: Colors.white,
                size: 40,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'IntelliPrep',
              style: TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'A/L ICT Student App',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 40),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                color: Colors.white,
                strokeWidth: 2.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
