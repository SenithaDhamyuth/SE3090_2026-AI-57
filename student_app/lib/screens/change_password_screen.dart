import 'dart:convert';

import 'package:flutter/material.dart';
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

      final data = jsonDecode(response.body);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final message = data is Map<String, dynamic>
            ? data['message']?.toString()
            : null;
        throw Exception(message ?? 'Request failed (${response.statusCode}).');
      }

      if (!mounted) return;
      onSuccess();
      if (path.endsWith('/verify')) {
        _showMessage('Password updated successfully.');
      }
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
        backgroundColor: isError ? Colors.red.shade600 : Colors.green.shade600,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Change Password'),
        backgroundColor: Colors.orange,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'We will email a one-time verification code to your account address. '
                  'The code expires after 10 minutes.',
                ),
                const SizedBox(height: 20),
                if (!_codeSent)
                  FilledButton.icon(
                    onPressed: _busy ? null : _requestCode,
                    icon: const Icon(Icons.email_outlined),
                    label: Text(_busy ? 'Sending...' : 'Send Verification Code'),
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.orange,
                      minimumSize: const Size.fromHeight(50),
                    ),
                  )
                else ...[
                  TextFormField(
                    controller: _codeController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    decoration: const InputDecoration(
                      labelText: 'Email verification code',
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) {
                      if (value == null || !RegExp(r'^\d{6}$').hasMatch(value)) {
                        return 'Enter the six-digit code from your email.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: true,
                    maxLength: 72,
                    decoration: const InputDecoration(
                      labelText: 'New password',
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) {
                      if (value == null || value.length < 12) {
                        return 'Use at least 12 characters.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _confirmController,
                    obscureText: true,
                    maxLength: 72,
                    decoration: const InputDecoration(
                      labelText: 'Confirm new password',
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) {
                      if (value != _passwordController.text) {
                        return 'Passwords do not match.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _busy ? null : _verifyAndChangePassword,
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.orange,
                      minimumSize: const Size.fromHeight(50),
                    ),
                    child: Text(_busy ? 'Updating...' : 'Verify and Update Password'),
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
      ),
    );
  }
}
