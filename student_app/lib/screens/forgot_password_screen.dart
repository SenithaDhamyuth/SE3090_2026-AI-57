import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
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
      final response = await http.post(
        ApiConstants.endpoint('api/auth/forgot-password/request'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email}),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        setState(() => _codeSent = true);
        _showSnack('If the email exists, an OTP has been sent.', isError: false);
      } else {
        final data = jsonDecode(response.body);
        _showSnack(data['message'] ?? 'Failed to send OTP.');
      }
    } catch (e) {
      _showSnack('Network error. Please try again.');
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
      final response = await http.post(
        ApiConstants.endpoint('api/auth/forgot-password/verify'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'code': code,
          'newPassword': newPassword,
        }),
      );

      if (response.statusCode >= 200 && response.statusCode < 300) {
        _showSnack('Password reset successful. Please log in.', isError: false);
        if (mounted) Navigator.pop(context);
      } else {
        final data = jsonDecode(response.body);
        _showSnack(data['message'] ?? 'Invalid or expired OTP.');
      }
    } catch (e) {
      _showSnack('Network error. Please try again.');
    } finally {
      if (mounted) setState(() => _isVerifying = false);
    }
  }

  void _showSnack(String message, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: isError ? Colors.red : Colors.green,
      behavior: SnackBarBehavior.floating,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: AppBar(
        title: const Text('Forgot Password'),
        backgroundColor: Colors.orange,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.lock_reset_rounded, size: 80, color: Colors.orange),
              const SizedBox(height: 24),
              const Text(
                'Reset Your Password',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                _codeSent 
                    ? 'Enter the 6-digit code sent to your email.'
                    : 'Enter your email address to receive an OTP.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600),
              ),
              const SizedBox(height: 32),
              
              // Step 1: Email Request
              TextField(
                controller: _emailController,
                enabled: !_codeSent,
                decoration: InputDecoration(
                  labelText: 'Email Address',
                  prefixIcon: const Icon(Icons.email_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  filled: true,
                  fillColor: Colors.white,
                ),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 16),
              
              if (!_codeSent)
                SizedBox(
                  height: 52,
                  child: FilledButton(
                    onPressed: _isRequesting ? null : _requestOTP,
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.orange,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: _isRequesting 
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('Send OTP', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  ),
                ),

              // Step 2: Verification
              if (_codeSent) ...[
                TextField(
                  controller: _codeController,
                  decoration: InputDecoration(
                    labelText: '6-Digit OTP',
                    prefixIcon: const Icon(Icons.password_rounded),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: 'New Password',
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  height: 52,
                  child: FilledButton(
                    onPressed: _isVerifying ? null : _verifyOTP,
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.orange,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: _isVerifying 
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('Verify & Reset', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  ),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => setState(() => _codeSent = false),
                  child: const Text('Use a different email'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
