import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

import '../ui/prep_ui.dart';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../api_constants.dart';

class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _codeSent = false;
  bool _busy = false;
  bool _hidePassword = true;
  bool _hideConfirm = true;

  @override
  void dispose() {
    _codeController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _requestCode() async {
    await _sendRequest(
      'api/auth/password-change/request',
      const {},
      onSuccess: () {
        setState(() => _codeSent = true);
        _showMessage('A verification code was sent to your email address.');
      },
    );
  }

  Future<void> _verifyAndChangePassword() async {
    if (!_formKey.currentState!.validate()) return;
    await _sendRequest(
      'api/auth/password-change/verify',
      {
        'code': _codeController.text.trim(),
        'newPassword': _passwordController.text,
      },
      onSuccess: () {
        Navigator.of(context).pop();
      },
    );
  }

  Future<void> _sendRequest(
    String path,
    Map<String, Object> body, {
    required VoidCallback onSuccess,
  }) async {
    setState(() => _busy = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? '';
      final response = await http
          .post(
            ApiConstants.endpoint(path),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));

      // Dev-only: log HTTP status and content-type. Never logs credentials.
      assert(() {
        final ct = response.headers['content-type'] ?? '';
        // ignore: avoid_print
        print(
          '[IntelliPrep][change-password] '
          'HTTP ${response.statusCode} — content-type: $ct',
        );
        return true;
      }());

      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (!mounted) return;
        onSuccess();
        if (path.endsWith('/verify')) {
          _showMessage('Password updated successfully.');
        }
        return;
      }

      // HTTP error — safely extract a message from a JSON body only.
      final contentType = response.headers['content-type'] ?? '';
      String? serverMessage;
      if (contentType.contains('application/json')) {
        try {
          final data = jsonDecode(response.body);
          if (data is Map<String, dynamic>) {
            serverMessage = data['message']?.toString();
          }
        } on FormatException {
          // Body claimed JSON but was malformed — use fallback below.
        }
      }
      throw Exception(
        serverMessage ?? 'Request failed (${response.statusCode}).',
      );
    } on TimeoutException {
      if (!mounted) return;
      _showMessage(
        'The request timed out. Check your connection and try again.',
        isError: true,
      );
    } on SocketException {
      if (!mounted) return;
      _showMessage(
        'Unable to reach the server. Check your internet connection.',
        isError: true,
      );
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().replaceFirst('Exception: ', '');
      _showMessage(message, isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showMessage(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? PrepColors.error : PrepColors.primary,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Change password')),
    body: PrepPage(
      maxWidth: 560,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const PrepHeading(
            eyebrow: 'ACCOUNT SECURITY',
            title: 'A fresh start for your password',
            subtitle: 'We’ll email a verification code to your account address. The code expires after 10 minutes.',
          ),
          const SizedBox(height: 24),
          PrepPill(
            _codeSent
                ? 'Step 2 of 2 · Verify and update'
                : 'Step 1 of 2 · Confirm it’s you',
            icon: Icons.verified_user_outlined,
          ),
          const SizedBox(height: 20),
          PrepCard(
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (!_codeSent)
                    FilledButton.icon(
                      onPressed: _busy ? null : _requestCode,
                      icon: const Icon(Icons.mail_outline_rounded),
                      label: _busy
                          ? const PrepBusyLabel('Sending…')
                          : const Text('Send verification code'),
                    )
                  else ...[
                    TextFormField(
                      controller: _codeController,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.oneTimeCode],
                      decoration: const InputDecoration(
                        labelText: 'Email verification code',
                        prefixIcon: Icon(Icons.password_rounded),
                      ),
                      validator: (value) {
                        if (value == null ||
                            !RegExp(r'^\d{6}$').hasMatch(value)) {
                          return 'Enter the six-digit code from your email.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: _hidePassword,
                      maxLength: 72,
                      textInputAction: TextInputAction.next,
                      autocorrect: false,
                      enableSuggestions: false,
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
                      validator: (value) {
                        if (value == null || value.length < 6) {
                          return 'Use at least 6 characters.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _confirmController,
                      obscureText: _hideConfirm,
                      maxLength: 72,
                      textInputAction: TextInputAction.done,
                      autocorrect: false,
                      enableSuggestions: false,
                      autofillHints: const [AutofillHints.newPassword],
                      decoration: InputDecoration(
                        labelText: 'Confirm new password',
                        prefixIcon: const Icon(Icons.lock_outline_rounded),
                        suffixIcon: IconButton(
                          tooltip: _hideConfirm
                              ? 'Show confirmation password'
                              : 'Hide confirmation password',
                          onPressed: () =>
                              setState(() => _hideConfirm = !_hideConfirm),
                          icon: Icon(
                            _hideConfirm
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator: (value) {
                        if (value != _passwordController.text) {
                          return 'Passwords do not match.';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _busy ? null : _verifyAndChangePassword,
                      child: _busy
                          ? const PrepBusyLabel('Updating…')
                          : const Text('Verify and update password'),
                    ),
                    TextButton(
                      onPressed: _busy ? null : _requestCode,
                      child: const Text('Send a new code'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
