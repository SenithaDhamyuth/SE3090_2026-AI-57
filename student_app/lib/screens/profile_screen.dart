import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../api_constants.dart';

/// ProfileScreen — lets an authenticated student update their display name
/// and password via PUT /api/student/profile.
///
/// Matches the app's orange-on-white design language:
///   • Orange AppBar
///   • White card form with rounded inputs
///   • FilledButton in orange for the save action
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey       = GlobalKey<FormState>();
  final _nameCtrl      = TextEditingController();
  final _passwordCtrl  = TextEditingController();
  final _confirmCtrl   = TextEditingController();

  bool _obscurePassword = true;
  bool _obscureConfirm  = true;
  bool _isLoading       = false;

  /// Cached email shown in the header (read-only — cannot be changed here).
  String _email = '';

  @override
  void initState() {
    super.initState();
    _loadCurrentProfile();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  // ── Load stored student info ────────────────────────────────────────────

  Future<void> _loadCurrentProfile() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _email = prefs.getString('student_email') ?? '';
      // Pre-fill name from stored value if available
      final savedName = prefs.getString('student_name') ?? '';
      _nameCtrl.text = savedName;
    });
  }

  // ── Submit handler ──────────────────────────────────────────────────────

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? '';

      final response = await http
          .put(
            ApiConstants.endpoint('api/student/profile'),
            headers: {
              'Content-Type':  'application/json',
              'Accept':        'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'fullName':    _nameCtrl.text.trim(),
              'newPassword': _passwordCtrl.text,
            }),
          )
          .timeout(const Duration(seconds: 15));

      if (!mounted) return;

      if (response.statusCode >= 200 && response.statusCode < 300) {
        // Persist updated name locally so the HomeScreen greets correctly
        await prefs.setString('student_name', _nameCtrl.text.trim());

        // Clear the password fields on success
        _passwordCtrl.clear();
        _confirmCtrl.clear();

        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
                SizedBox(width: 10),
                Text(
                  'Profile updated successfully!',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ],
            ),
            backgroundColor: Colors.green.shade600,
            behavior: SnackBarBehavior.floating,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            margin: const EdgeInsets.all(16),
            duration: const Duration(seconds: 3),
          ),
        );
      } else {
        final body = jsonDecode(response.body) as Map<String, dynamic>?;
        final msg  = body?['message'] as String? ?? 'Update failed.';
        _showError(msg);
      }
    } catch (e) {
      if (!mounted) return;
      final isTimeout = e.toString().contains('TimeoutException');
      _showError(
        isTimeout
            ? 'Request timed out. Check your connection and try again.'
            : 'Could not update profile. Please try again.',
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red.shade600,
        behavior: SnackBarBehavior.floating,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  // ── Build ───────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: AppBar(
        backgroundColor: Colors.orange,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'My Profile',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── Avatar / email header ────────────────────────────────
                _ProfileHeader(email: _email),
                const SizedBox(height: 28),

                // ── Form card ─────────────────────────────────────────────
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.grey.shade100),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(12),
                        blurRadius: 16,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── Section: Account Details ────────────────────
                        _SectionLabel(
                          icon: Icons.person_outline_rounded,
                          label: 'Account Details',
                        ),
                        const SizedBox(height: 16),

                        // Full Name
                        _buildInputField(
                          controller: _nameCtrl,
                          label: 'Full Name',
                          hint:  'e.g. Amal Perera',
                          icon:  Icons.badge_outlined,
                          textInputAction: TextInputAction.next,
                          validator: (v) {
                            if (v == null || v.trim().isEmpty) {
                              return 'Full name is required.';
                            }
                            if (v.trim().length < 2) {
                              return 'Full name must be at least 2 characters.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),

                        // Email (read-only)
                        _buildInputField(
                          initialValue: _email,
                          label:    'Email Address',
                          hint:     'your@email.com',
                          icon:     Icons.email_outlined,
                          readOnly: true,
                        ),

                        const SizedBox(height: 28),
                        _SectionLabel(
                          icon: Icons.lock_outline_rounded,
                          label: 'Change Password',
                        ),
                        const SizedBox(height: 16),

                        // New Password
                        _buildPasswordField(
                          controller:   _passwordCtrl,
                          label:        'New Password',
                          obscure:      _obscurePassword,
                          onToggle:     () => setState(
                              () => _obscurePassword = !_obscurePassword),
                          textInputAction: TextInputAction.next,
                          validator: (v) {
                            if (v == null || v.isEmpty) {
                              return 'Password is required.';
                            }
                            if (v.length < 6) {
                              return 'Password must be at least 6 characters.';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),

                        // Confirm Password
                        _buildPasswordField(
                          controller:   _confirmCtrl,
                          label:        'Confirm Password',
                          obscure:      _obscureConfirm,
                          onToggle:     () => setState(
                              () => _obscureConfirm = !_obscureConfirm),
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _handleSave(),
                          validator: (v) {
                            if (v == null || v.isEmpty) {
                              return 'Please confirm your password.';
                            }
                            if (v != _passwordCtrl.text) {
                              return 'Passwords do not match.';
                            }
                            return null;
                          },
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 28),

                // ── Save button ──────────────────────────────────────────
                SizedBox(
                  height: 54,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.orange,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      textStyle: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    onPressed: _isLoading ? null : _handleSave,
                    child: _isLoading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2.5,
                            ),
                          )
                        : const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.save_rounded, size: 20),
                              SizedBox(width: 8),
                              Text('Save Changes'),
                            ],
                          ),
                  ),
                ),

                const SizedBox(height: 12),
                Center(
                  child: Text(
                    'Your email address cannot be changed here.',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.grey.shade400,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Input helpers ───────────────────────────────────────────────────────

  Widget _buildInputField({
    TextEditingController? controller,
    String? initialValue,
    required String label,
    required String hint,
    required IconData icon,
    bool readOnly = false,
    TextInputAction? textInputAction,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller:      controller,
      initialValue:    controller == null ? initialValue : null,
      readOnly:        readOnly,
      textInputAction: textInputAction,
      decoration: InputDecoration(
        labelText:   label,
        hintText:    hint,
        prefixIcon:  Icon(icon),
        filled:      true,
        fillColor:   readOnly ? Colors.grey.shade50 : Colors.white,
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade200)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade200)),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:
                const BorderSide(color: Colors.orange, width: 1.5)),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        labelStyle: TextStyle(
            color: readOnly ? Colors.grey.shade400 : null),
      ),
      style: TextStyle(
          color: readOnly ? Colors.grey.shade500 : const Color(0xFF1A1A1A),
          fontSize: 14),
      validator: validator,
    );
  }

  Widget _buildPasswordField({
    required TextEditingController controller,
    required String label,
    required bool obscure,
    required VoidCallback onToggle,
    TextInputAction? textInputAction,
    void Function(String)? onFieldSubmitted,
    required String? Function(String?) validator,
  }) {
    return TextFormField(
      controller:      controller,
      obscureText:     obscure,
      textInputAction: textInputAction,
      onFieldSubmitted: onFieldSubmitted,
      decoration: InputDecoration(
        labelText:  label,
        prefixIcon: const Icon(Icons.lock_outline_rounded),
        suffixIcon: IconButton(
          icon: Icon(
            obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
          ),
          onPressed: onToggle,
        ),
        filled:    true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade200)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.grey.shade200)),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:
                const BorderSide(color: Colors.orange, width: 1.5)),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      validator: validator,
    );
  }
}

// ── Sub-widgets ─────────────────────────────────────────────────────────────

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.email});

  final String email;

  String get _initials {
    final local = email.split('@').first;
    if (local.isEmpty) return '?';
    return local[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Colors.orange, Color(0xFFE65100)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(40),
              shape: BoxShape.circle,
              border: Border.all(
                  color: Colors.white.withAlpha(80), width: 2),
            ),
            child: Center(
              child: Text(
                _initials,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            email.isEmpty ? 'Your Account' : email,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(30),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Text(
              'Student Account',
              style: TextStyle(color: Colors.white70, fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.icon, required this.label});

  final IconData icon;
  final String   label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: Colors.orange.withAlpha(30),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: Colors.orange, size: 18),
        ),
        const SizedBox(width: 10),
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: Color(0xFF1A1A1A),
          ),
        ),
      ],
    );
  }
}
