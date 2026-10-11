import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

import '../ui/prep_ui.dart';

import 'package:http/http.dart' as http;

import '../api_constants.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailController = TextEditingController();
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isRequesting = false;
  bool _isVerifying = false;
  bool _codeSent = false;
  bool _hidePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _requestOTP() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      _showSnack('Please enter a valid email address.');
      return;
    }

    setState(() => _isRequesting = true);

    try {
      final response = await http
          .post(
            ApiConstants.endpoint('api/auth/forgot-password/request'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email}),
          )
          .timeout(const Duration(seconds: 15));

      // Dev-only: log status and content-type. Never logs email content.
      assert(() {
        final ct = response.headers['content-type'] ?? '';
        // ignore: avoid_print
        print(
          '[IntelliPrep][forgot-password/request] '
          'HTTP ${response.statusCode} — content-type: $ct',
        );
        return true;
      }());

      if (response.statusCode >= 200 && response.statusCode < 300) {
        setState(() => _codeSent = true);
        _showSnack(
          'If the email exists, an OTP has been sent.',
          isError: false,
        );
      } else {
        // HTTP error from the API — try to extract a message from the JSON body.
        final serverMessage = _extractMessage(response);
        if (response.statusCode == 429) {
          _showSnack(
            serverMessage ??
                'Please wait a moment before requesting another code.',
          );
        } else {
          _showSnack(
            serverMessage ??
                'Failed to send OTP (HTTP ${response.statusCode}). Please try again.',
          );
        }
      }
    } on TimeoutException {
      _showSnack('The request timed out. Check your connection and try again.');
    } on SocketException {
      _showSnack('Unable to reach the server. Check your internet connection.');
    } catch (e) {
      // Log exception type for debugging without logging sensitive data.
      assert(() {
        // ignore: avoid_print
        print(
          '[IntelliPrep][forgot-password/request] '
          'exception type: ${e.runtimeType}',
        );
        return true;
      }());
      _showSnack('Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _isRequesting = false);
    }
  }

  Future<void> _verifyOTP() async {
    final email = _emailController.text.trim();
    final code = _codeController.text.trim();
    final newPassword = _passwordController.text;

    if (code.length != 6) {
      _showSnack('Please enter a 6-digit OTP.');
      return;
    }
    if (newPassword.length < 6) {
      _showSnack('Password must be at least 6 characters.');
      return;
    }

    setState(() => _isVerifying = true);

    try {
      final response = await http
          .post(
            ApiConstants.endpoint('api/auth/forgot-password/verify'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'email': email,
              'code': code,
              'newPassword': newPassword,
            }),
          )
          .timeout(const Duration(seconds: 15));

      // Dev-only: log status and content-type.
      assert(() {
        final ct = response.headers['content-type'] ?? '';
        // ignore: avoid_print
        print(
          '[IntelliPrep][forgot-password/verify] '
          'HTTP ${response.statusCode} — content-type: $ct',
        );
        return true;
      }());

      if (response.statusCode >= 200 && response.statusCode < 300) {
        _showSnack('Password reset successful. Please log in.', isError: false);
        if (mounted) Navigator.pop(context);
      } else {
        final serverMessage = _extractMessage(response);
        _showSnack(
          serverMessage ??
              'Invalid or expired OTP (HTTP ${response.statusCode}).',
        );
      }
    } on TimeoutException {
      _showSnack('The request timed out. Check your connection and try again.');
    } on SocketException {
      _showSnack('Unable to reach the server. Check your internet connection.');
    } catch (e) {
      assert(() {
        // ignore: avoid_print
        print(
          '[IntelliPrep][forgot-password/verify] '
          'exception type: ${e.runtimeType}',
        );
        return true;
      }());
      _showSnack('Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _isVerifying = false);
    }
  }

  /// Safely extracts `message` from a JSON error body.
  ///
  /// Returns null when the body is not JSON (e.g. proxy HTML page), so the
  /// caller can fall back to a generic message instead of crashing.
  String? _extractMessage(http.Response response) {
    final contentType = response.headers['content-type'] ?? '';
    if (!contentType.contains('application/json')) return null;
    try {
      final data = jsonDecode(response.body);
      if (data is Map<String, dynamic>) {
        return data['message']?.toString();
      }
    } on FormatException {
      // Body claimed to be JSON but was malformed — treat as no message.
    }
    return null;
  }

  void _showSnack(String message, {bool isError = true}) {
    if (!mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? PrepColors.error : PrepColors.primary,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Reset password')),
    body: PrepPage(
      maxWidth: 560,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 12),
          const PrepHeading(
            eyebrow: 'BACK TO LEARNING',
            title: "Let\u2019s get you back in",
            subtitle: 'Reset your password using the email linked to your student account.',
          ),
          const SizedBox(height: 24),
          PrepPill(
            _codeSent
                ? 'Step 2 of 2 · New password'
                : 'Step 1 of 2 · Email verification',
            icon: Icons.lock_reset_rounded,
          ),
          const SizedBox(height: 20),
          PrepCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _emailController,
                  enabled: !_codeSent,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.email],
                  autocorrect: false,
                  decoration: const InputDecoration(
                    labelText: 'Email address',
                    prefixIcon: Icon(Icons.alternate_email_rounded),
                  ),
                ),
                const SizedBox(height: 20),
                if (!_codeSent)
                  FilledButton(
                    onPressed: _isRequesting ? null : _requestOTP,
                    child: _isRequesting
                        ? const PrepBusyLabel('Sending code…')
                        : const Text('Send verification code'),
                  ),
                if (_codeSent) ...[
                  Semantics(
                    liveRegion: true,
                    child: const Text(
                      'If an account matches this email, a verification code has been sent.',
                    ),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _codeController,
                    keyboardType: TextInputType.number,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    maxLength: 6,
                    decoration: const InputDecoration(
                      labelText: '6-digit verification code',
                      prefixIcon: Icon(Icons.password_rounded),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _passwordController,
                    obscureText: _hidePassword,
                    autocorrect: false,
                    enableSuggestions: false,
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.newPassword],
                    decoration: InputDecoration(
                      labelText: 'New password',
                      helperText: 'Use at least 6 characters.',
                      prefixIcon: const Icon(Icons.lock_outline_rounded),
                      suffixIcon: IconButton(
                        tooltip: _hidePassword
                            ? 'Show password'
                            : 'Hide password',
                        onPressed: () =>
                            setState(() => _hidePassword = !_hidePassword),
                        icon: Icon(
                          _hidePassword
                              ? Icons.visibility_outlined
                              : Icons.visibility_off_outlined,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _isVerifying ? null : _verifyOTP,
                    child: _isVerifying
                        ? const PrepBusyLabel('Resetting password…')
                        : const Text('Verify and reset password'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _isVerifying
                        ? null
                        : () => setState(() => _codeSent = false),
                    child: const Text('Use a different email'),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
