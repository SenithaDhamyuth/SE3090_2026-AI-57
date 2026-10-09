import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';

import '../api_constants.dart';

/// ProfileScreen — lets an authenticated student update their display name,
/// phone number, address, college, and avatar.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl    = TextEditingController();
  final _phoneCtrl   = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _collegeCtrl = TextEditingController();

  bool    _isLoading       = false;
  String  _email           = '';
  String? _profileImageUrl;

  @override
  void initState() {
    super.initState();
    _loadCurrentProfile();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _addressCtrl.dispose();
    _collegeCtrl.dispose();
    super.dispose();
  }

  /// Loads locally-stored prefs first (fast), then fetches extended profile
  /// details from the backend if a student_id is available.
  Future<void> _loadCurrentProfile() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _email           = prefs.getString('student_email') ?? '';
      _nameCtrl.text   = prefs.getString('student_name')  ?? '';
      _profileImageUrl = prefs.getString('profileImageUrl');
    });

    // Optionally fetch extra fields from the backend
    final userId = prefs.getString('student_id');
    if (userId == null || userId.isEmpty) return;

    try {
      final token = prefs.getString('auth_token') ?? '';
      final response = await http.get(
        ApiConstants.endpoint('api/studentprofile/$userId'),
        headers: {
          'Authorization': 'Bearer $token',
          'Accept': 'application/json',
        },
      ).timeout(const Duration(seconds: 15));

      if (!mounted) return;
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _phoneCtrl.text   = (data['phoneNumber'] as String?) ?? '';
          _addressCtrl.text = (data['address']     as String?) ?? '';
          _collegeCtrl.text = (data['college']     as String?) ?? '';
        });
      }
    } on TimeoutException {
      // Silently ignore — fields remain blank, user can fill them in
    } catch (_) {
      // Silently ignore
    }
  }

  /// Picks an image from the gallery, optionally compresses it, then uploads
  /// it to the profile-picture endpoint. Kept exactly as-is from the original.
  Future<void> _pickAndUploadImage() async {
    if (_isLoading) return;
    setState(() => _isLoading = true);

    try {
      final pickedFile = await ImagePicker().pickImage(
        source: ImageSource.gallery,
      );
      if (pickedFile == null) return;

      final file = File(pickedFile.path);
      var imageToUpload = file;
      if (await file.length() > 2 * 1024 * 1024) {
        final targetPath = '${file.absolute.parent.path}/temp_compressed.jpg';
        final compressed = await FlutterImageCompress.compressAndGetFile(
          file.absolute.path,
          targetPath,
          quality: 70,
        );
        if (compressed != null) imageToUpload = File(compressed.path);
      }

      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? '';
      if (token.isEmpty) throw StateError('Authentication is required.');

      var request = http.MultipartRequest(
        'POST',
        ApiConstants.endpoint('api/studentprofile/upload-picture'),
      );
      request.headers['Authorization'] = 'Bearer $token';
      request.files.add(
        await http.MultipartFile.fromPath('file', imageToUpload.path),
      );

      var streamedResponse = await request.send();
      var response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final url = data['profileImageUrl'] as String?;
        if (url == null || url.isEmpty) {
          throw const FormatException(
            'Upload response did not include an image URL.',
          );
        }
        final fullUrl = Uri.parse(url).hasScheme
            ? url
            : '${ApiConstants.baseUrl}$url';
        await prefs.setString('profileImageUrl', fullUrl);
        if (!mounted) return;
        setState(() => _profileImageUrl = fullUrl);
        _showSnack('Profile picture updated!', isError: false);
      } else {
        _showSnack('Failed to upload picture. Please try again.');
      }
    } catch (_) {
      _showSnack('Could not upload picture. Please try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  /// Sends updated profile fields to the backend and persists the name locally.
  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token') ?? '';
      if (token.isEmpty) throw StateError('Authentication is required.');

      final response = await http.put(
        ApiConstants.endpoint('api/studentprofile/update-details'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'fullName':    _nameCtrl.text.trim(),
          'phoneNumber': _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
          'address':     _addressCtrl.text.trim().isEmpty ? null : _addressCtrl.text.trim(),
          'college':     _collegeCtrl.text.trim().isEmpty ? null : _collegeCtrl.text.trim(),
        }),
      ).timeout(const Duration(seconds: 15));

      if (!mounted) return;
      if (response.statusCode >= 200 && response.statusCode < 300) {
        await prefs.setString('student_name', _nameCtrl.text.trim());
        _showSnack('Profile updated successfully!', isError: false);
      } else {
        final decoded = jsonDecode(response.body);
        final body = decoded is Map<String, dynamic> ? decoded : null;
        _showSnack(body?['message'] as String? ?? 'Update failed.');
      }
    } on TimeoutException {
      _showSnack('Request timed out. Please check your connection.');
    } catch (e) {
      _showSnack('Could not update profile. Please try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showSnack(String message, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red.shade600 : Colors.green.shade600,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  // ── Shared field decoration ─────────────────────────────────────────────
  InputDecoration _fieldDecoration({
    required String label,
    required IconData icon,
  }) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon),
      filled: true,
      fillColor: const Color(0xFFFAFAFA),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: Colors.grey.shade300),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(
          color: Colors.orange,
          width: 1.5,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFAFAFA),
      appBar: AppBar(
        backgroundColor: Colors.orange,
        foregroundColor: Colors.white,
        title: const Text(
          'My Profile',
          style: TextStyle(fontWeight: FontWeight.bold),
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
                // ── Avatar / header ────────────────────────────────────────
                _ProfileHeader(
                  email: _email,
                  imageUrl: _profileImageUrl,
                  onTapAvatar: _pickAndUploadImage,
                ),
                const SizedBox(height: 28),

                // ── Editable fields card ───────────────────────────────────
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.grey.shade200),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(8),
                        blurRadius: 18,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  padding: const EdgeInsets.all(22),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const _SectionLabel(
                        icon: Icons.manage_accounts_outlined,
                        label: 'Account Details',
                      ),
                      const SizedBox(height: 5),
                      Text(
                        'Update the personal information on your account.',
                        style: TextStyle(
                          fontSize: 13,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 22),

                      // Full Name ──────────────────────────────────────────
                      TextFormField(
                        controller: _nameCtrl,
                        textCapitalization: TextCapitalization.words,
                        decoration: _fieldDecoration(
                          label: 'Full Name',
                          icon: Icons.person_outline_rounded,
                        ),
                        validator: (v) => (v == null || v.trim().isEmpty)
                            ? 'Name is required'
                            : null,
                      ),
                      const SizedBox(height: 16),

                      // Email (read-only) ───────────────────────────────────
                      TextFormField(
                        initialValue: _email,
                        readOnly: true,
                        enableInteractiveSelection: false,
                        style: TextStyle(color: Colors.grey.shade600),
                        decoration: InputDecoration(
                          labelText: 'Email Address',
                          prefixIcon: Icon(
                            Icons.mail_outline_rounded,
                            color: Colors.grey.shade500,
                          ),
                          suffixIcon: Icon(
                            Icons.lock_outline_rounded,
                            size: 18,
                            color: Colors.grey.shade500,
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF1F2F4),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: BorderSide(color: Colors.grey.shade200),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Your email address cannot be changed here.',
                        style: TextStyle(
                          fontSize: 11,
                          color: Colors.grey.shade500,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Phone Number ───────────────────────────────────────
                      TextFormField(
                        controller: _phoneCtrl,
                        keyboardType: TextInputType.phone,
                        decoration: _fieldDecoration(
                          label: 'Phone Number',
                          icon: Icons.phone_outlined,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Address ────────────────────────────────────────────
                      TextFormField(
                        controller: _addressCtrl,
                        maxLines: 3,
                        decoration: _fieldDecoration(
                          label: 'Address',
                          icon: Icons.home_outlined,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // College ────────────────────────────────────────────
                      TextFormField(
                        controller: _collegeCtrl,
                        textCapitalization: TextCapitalization.words,
                        decoration: _fieldDecoration(
                          label: 'College',
                          icon: Icons.school_outlined,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),

                // ── Save button ───────────────────────────────────────────
                SizedBox(
                  height: 54,
                  child: FilledButton(
                    onPressed: _isLoading ? null : _handleSave,
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.orange,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2.5,
                            ),
                          )
                        : const Text(
                            'Save Changes',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
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
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.email,
    this.imageUrl,
    required this.onTapAvatar,
  });

  final String email;
  final String? imageUrl;
  final VoidCallback onTapAvatar;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [
            Color(0xFFFF9800),
            Color(0xFFF57C00),
          ], // Richer orange gradient
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.orange.withAlpha(80),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          GestureDetector(
            onTap: onTapAvatar,
            child: Stack(
              alignment: Alignment.bottomRight,
              children: [
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withAlpha(80),
                      width: 4,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(20),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: CircleAvatar(
                    radius: 48,
                    backgroundColor: Colors.white.withAlpha(40),
                    backgroundImage: imageUrl != null
                        ? NetworkImage(imageUrl!)
                        : null,
                    child: imageUrl == null
                        ? Text(
                            email.isNotEmpty ? email[0].toUpperCase() : '?',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 36,
                              fontWeight: FontWeight.bold,
                            ),
                          )
                        : null,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withAlpha(30),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.camera_alt_rounded,
                    size: 20,
                    color: Colors.orange,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            email,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(40),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Text(
              'Student Account',
              style: TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
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
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: Colors.orange),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
      ],
    );
  }
}
