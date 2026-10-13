import 'dart:convert';

import 'package:flutter/material.dart';

import '../ui/prep_ui.dart';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../api_constants.dart';
import 'home_screen.dart';
import 'forgot_password_screen.dart';

/// LoginScreen — entry point for authenticated students.
///
/// Provides email / password sign-in, persists the JWT via SharedPreferences,
/// and routes to [HomeScreen].
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _obscurePassword = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  // ── Login logic ──────────────────────────────────────────────────────

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final prefs = await SharedPreferences.getInstance();
      final backendUrl = ApiConstants.endpoint('api/auth/login');
      final normalizedEmail = ApiConstants.normalizeEmail(
        _emailController.text,
      );

      final response = await http
          .post(
            backendUrl,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: jsonEncode({
              'email': normalizedEmail,
              'password': _passwordController.text,
            }),
          )
          .timeout(const Duration(seconds: 10));

      if (!mounted) return;

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final token = data['token']?.toString();

        if (token == null || token.isEmpty) {
          throw Exception('Missing token in response');
        }
        if (data['role']?.toString() != 'Student') {
          throw Exception(
            'This account is not registered as a student account.',
          );
        }

        await prefs.setString('auth_token', token);
        await prefs.setString('student_email', normalizedEmail);

        setState(() => _isLoading = false);

        if (!mounted) return;

        Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(builder: (_) => const HomeScreen()),
        );
        return;
      }

      if (response.statusCode == 401) {
        String? diagnosticId;
        final responseIsHtml =
            response.headers['content-type']?.toLowerCase().contains(
              'text/html',
            ) ??
            false;
        try {
          final responseBody = jsonDecode(response.body);
          if (responseBody is Map<String, dynamic>) {
            diagnosticId = responseBody['diagnosticId']?.toString();
          }
        } on FormatException {
          diagnosticId = null;
        }
        setState(() => _isLoading = false);
        if (!mounted) return;
        await _showLoginDiagnostics(
          backendUrl,
          diagnosticId: diagnosticId,
          responseIsHtml: responseIsHtml,
        );
        return;
      }

      throw Exception('Login failed (${response.statusCode})');
    } catch (e) {
      if (!mounted) return;

      setState(() => _isLoading = false);

      final message =
          e.toString().contains('socket') || e.toString().contains('Timeout')
          ? 'Unable to reach the server. Check your internet connection.'
          : e.toString().contains('not registered as a student')
          ? 'This login is for student accounts. Use a student account or contact your administrator.'
          : 'Login failed. Please try again.';

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
      );
    }
  }

  Future<void> _showLoginDiagnostics(
    Uri loginUrl, {
    String? diagnosticId,
    required bool responseIsHtml,
  }) async {
    String? healthCheckResult;
    bool isChecking = false;
    final healthUrl = ApiConstants.endpoint('health');

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          icon: const Icon(Icons.manage_search, color: Color(0xFFEF6C00)),
          title: const Text('Login diagnosis'),
          content: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'The server returned HTTP 401: the email or password is invalid. '
                  'For privacy, it does not reveal which credential was incorrect.',
                ),
                const SizedBox(height: 16),
                _diagnosticLine('API host', loginUrl.origin),
                _diagnosticLine('Login endpoint', loginUrl.path),
                _diagnosticLine(
                  'Email handling',
                  'Trimmed and converted to lowercase before sending',
                ),
                if (diagnosticId != null && diagnosticId.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  _diagnosticLine('Support reference', diagnosticId),
                ],
                const SizedBox(height: 12),
                if (responseIsHtml) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF4E5),
                      border: Border.all(color: const Color(0xFFFFD08A)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      'The 401 response was HTML instead of JSON. A proxy or gateway may have generated it before the request reached the login endpoint.',
                      style: TextStyle(
                        color: Color(0xFF8A4B08),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ] else if (diagnosticId == null || diagnosticId.isEmpty) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF4E5),
                      border: Border.all(color: const Color(0xFFFFD08A)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      'The API response did not include a support reference. If the problem continues, ask the API administrator to check the server logs.',
                      style: TextStyle(
                        color: Color(0xFF8A4B08),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                const Text(
                  'Check these in order:\n'
                  '1. Confirm the student appears in Student Directory in the admin panel.\n'
                  '2. Confirm that panel uses this same API host.\n'
                  '3. Use the student password, not an admin password. If unsure, use Forgot Password and set a new one.\n'
                  '4. If it still fails, give the support reference to the API administrator. Server logs can identify the rejection without logging the email or password.',
                ),
                const SizedBox(height: 12),
                if (healthCheckResult != null)
                  Text(
                    healthCheckResult!,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: isChecking
                  ? null
                  : () async {
                      setDialogState(() {
                        isChecking = true;
                        healthCheckResult = null;
                      });

                      try {
                        final response = await http
                            .get(healthUrl)
                            .timeout(const Duration(seconds: 8));
                        final healthy = response.statusCode == 200;
                        if (!dialogContext.mounted) return;
                        setDialogState(() {
                          healthCheckResult = healthy
                              ? 'Connection check passed (HTTP 200). The API is reachable; '
                                    'this does not verify the student account or database.'
                              : 'Connection check returned HTTP ${response.statusCode}. '
                                    'Confirm the API deployment is healthy.';
                        });
                      } catch (_) {
                        if (!dialogContext.mounted) return;
                        setDialogState(() {
                          healthCheckResult =
                              'Connection check failed. Check the internet connection '
                              'or whether the API is available.';
                        });
                      } finally {
                        if (dialogContext.mounted) {
                          setDialogState(() => isChecking = false);
                        }
                      }
                    },
              child: Text(isChecking ? 'Checking…' : 'Check API connection'),
            ),
            FilledButton(
              onPressed: isChecking
                  ? null
                  : () => Navigator.of(dialogContext).pop(),
              child: const Text('Close'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _diagnosticLine(String label, String value) => Padding(
    padding: const EdgeInsets.only(bottom: 5),
    child: RichText(
      text: TextSpan(
        style: Theme.of(context).textTheme.bodySmall,
        children: [
          TextSpan(
            text: '$label: ',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          TextSpan(text: value),
        ],
      ),
    ),
  );

  // ── Build ────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: PrepPage(
        maxWidth: 560,
        child: AutofillGroup(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 20),
              PrepCard(
                color: PrepColors.navy,
                padding: const EdgeInsets.all(28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.school_rounded,
                      color: Color(0xFFD7F2B8),
                      size: 38,
                    ),
                    const SizedBox(height: 28),
                    Text(
                      'IntelliPrep',
                      style: Theme.of(context).textTheme.headlineLarge
                          ?.copyWith(color: Colors.white),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Build confidence.\nOne exam at a time.',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 24),
                    const PrepPill(
                      'A/L ICT · Student portal',
                      color: Colors.white,
                      background: Color(0xFF30535C),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              PrepCard(
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const PrepHeading(
                        title: 'Welcome back',
                        subtitle: 'Sign in with your student account.',
                      ),
                      const SizedBox(height: 24),
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [
                          AutofillHints.username,
                          AutofillHints.email,
                        ],
                        autocorrect: false,
                        decoration: const InputDecoration(
                          labelText: 'Email address',
                          prefixIcon: Icon(Icons.alternate_email_rounded),
                        ),
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return 'Please enter your email.';
                          }
                          if (!value.contains('@')) {
                            return 'Enter a valid email address.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 18),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        textInputAction: TextInputAction.done,
                        autofillHints: const [AutofillHints.password],
                        autocorrect: false,
                        enableSuggestions: false,
                        textCapitalization: TextCapitalization.none,
                        onFieldSubmitted: (_) {
                          if (!_isLoading) _handleLogin();
                        },
                        decoration: InputDecoration(
                          labelText: 'Password',
                          prefixIcon: const Icon(Icons.lock_outline_rounded),
                          suffixIcon: IconButton(
                            tooltip: _obscurePassword
                                ? 'Show password'
                                : 'Hide password',
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_outlined
                                  : Icons.visibility_off_outlined,
                            ),
                            onPressed: () => setState(
                              () => _obscurePassword = !_obscurePassword,
                            ),
                          ),
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Please enter your password.';
                          }
                          if (value.length < 4) {
                            return 'Password must be at least 4 characters.';
                          }
                          return null;
                        },
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => const ForgotPasswordScreen(),
                            ),
                          ),
                          child: const Text('Forgot password?'),
                        ),
                      ),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: _isLoading ? null : _handleLogin,
                        child: _isLoading
                            ? const PrepBusyLabel('Signing in…')
                            : const Text('Sign in'),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Use the email and password issued for your student account.',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
