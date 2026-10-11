import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';

import '../api_constants.dart';
import '../ui/prep_ui.dart';
import 'change_password_screen.dart';

/// ProfileScreen — lets an authenticated student update their display name,
/// phone number, address, college, and avatar.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _collegeCtrl = TextEditingController();

  bool _isLoading = false;
  String _email = '';
  String? _profileImageUrl;
  bool _profileLoading = true;
  String? _profileError;

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
    setState(() {
      _profileLoading = true;
      _profileError = null;
    });
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _email = prefs.getString('student_email') ?? '';
      _nameCtrl.text = prefs.getString('student_name') ?? '';
      _profileImageUrl = prefs.getString('profileImageUrl');
    });

    // Optionally fetch extra fields from the backend
    final userId = prefs.getString('student_id');
    if (userId == null || userId.isEmpty) {
      setState(() => _profileLoading = false);
      return;
    }

    try {
      final token = prefs.getString('auth_token') ?? '';
      final response = await http
          .get(
            ApiConstants.endpoint('api/studentprofile/$userId'),
            headers: {
              'Authorization': 'Bearer $token',
              'Accept': 'application/json',
            },
          )
          .timeout(const Duration(seconds: 15));

      if (!mounted) return;
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _phoneCtrl.text = (data['phoneNumber'] as String?) ?? '';
          _addressCtrl.text = (data['address'] as String?) ?? '';
          _collegeCtrl.text = (data['college'] as String?) ?? '';
        });
      } else {
        setState(
          () => _profileError =
              'Could not fetch account details. You can try again.',
        );
      }
    } on TimeoutException {
      if (mounted) {
        setState(
          () => _profileError = 'The connection timed out. Please try again.',
        );
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _profileError =
              'Could not load your details. Check your connection.',
        );
      }
    } finally {
      if (mounted) setState(() => _profileLoading = false);
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

      final response = await http
          .put(
            ApiConstants.endpoint('api/studentprofile/update-details'),
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'fullName': _nameCtrl.text.trim(),
              'phoneNumber': _phoneCtrl.text.trim().isEmpty
                  ? null
                  : _phoneCtrl.text.trim(),
              'address': _addressCtrl.text.trim().isEmpty
                  ? null
                  : _addressCtrl.text.trim(),
              'college': _collegeCtrl.text.trim().isEmpty
                  ? null
                  : _collegeCtrl.text.trim(),
            }),
          )
          .timeout(const Duration(seconds: 15));

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
        backgroundColor: isError ? PrepColors.error : PrepColors.primary,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  // ── Shared field decoration ─────────────────────────────────────────────
  InputDecoration _fieldDecoration({
    required String label,
    required IconData icon,
  }) => InputDecoration(labelText: label, prefixIcon: Icon(icon));

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('My profile')),
    body: PrepPage(
      maxWidth: 600,
      onRefresh: _loadCurrentProfile,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ProfileHeader(
            email: _email,
            imageUrl: _profileImageUrl,
            onTapAvatar: _isLoading ? null : _pickAndUploadImage,
          ),
          const SizedBox(height: 24),
          if (_profileLoading) ...[
            const PrepState(title: 'Loading profile details', loading: true),
            const SizedBox(height: 16),
          ],
          if (_profileError != null) ...[
            PrepState(
              title: 'Some details could not load',
              message: _profileError,
              action: 'Try again',
              onAction: _loadCurrentProfile,
            ),
            const SizedBox(height: 16),
          ],
          PrepCard(
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const PrepHeading(
                    title: 'Your details',
                    subtitle: 'Keep your student information up to date.',
                  ),
                  const SizedBox(height: 24),
                  TextFormField(
                    controller: _nameCtrl,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.name],
                    decoration: _fieldDecoration(
                      label: 'Full name',
                      icon: Icons.person_outline_rounded,
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? 'Name is required'
                        : null,
                  ),
                  const SizedBox(height: 18),
                  TextFormField(
                    key: ValueKey(_email),
                    initialValue: _email,
                    readOnly: true,
                    decoration: const InputDecoration(
                      labelText: 'Email address',
                      helperText: 'Your account email cannot be changed here.',
                      prefixIcon: Icon(Icons.alternate_email_rounded),
                      suffixIcon: Icon(Icons.lock_outline_rounded),
                    ),
                  ),
                  const SizedBox(height: 18),
                  TextFormField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.telephoneNumber],
                    decoration: _fieldDecoration(
                      label: 'Phone number',
                      icon: Icons.phone_outlined,
                    ),
                  ),
                  const SizedBox(height: 18),
                  TextFormField(
                    controller: _addressCtrl,
                    minLines: 2,
                    maxLines: 4,
                    keyboardType: TextInputType.multiline,
                    autofillHints: const [AutofillHints.fullStreetAddress],
                    decoration: _fieldDecoration(
                      label: 'Address',
                      icon: Icons.home_outlined,
                    ),
                  ),
                  const SizedBox(height: 18),
                  TextFormField(
                    controller: _collegeCtrl,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.done,
                    decoration: _fieldDecoration(
                      label: 'College',
                      icon: Icons.school_outlined,
                    ),
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: _isLoading || _profileLoading
                        ? null
                        : _handleSave,
                    child: _isLoading
                        ? const PrepBusyLabel('Saving changes…')
                        : const Text('Save changes'),
                  ),
                ],
              ),
            ),
          ),
          const PrepSection(title: 'Account security'),
          PrepAction(
            title: 'Change password',
            subtitle: 'Verify your email and set a new password.',
            icon: Icons.lock_outline_rounded,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => const ChangePasswordScreen(),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.email,
    this.imageUrl,
    required this.onTapAvatar,
  });
  final String email;
  final String? imageUrl;
  final VoidCallback? onTapAvatar;
  @override
  Widget build(BuildContext context) {
    final fallback = Center(
      child: Text(
        email.isNotEmpty ? email[0].toUpperCase() : 'S',
        style: const TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          color: PrepColors.primary,
        ),
      ),
    );
    return PrepCard(
      color: PrepColors.navy,
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Semantics(
            label: 'Profile photo',
            image: true,
            child: Container(
              width: 88,
              height: 88,
              clipBehavior: Clip.antiAlias,
              decoration: const BoxDecoration(
                color: PrepColors.mint,
                shape: BoxShape.circle,
              ),
              child: imageUrl == null
                  ? fallback
                  : Image.network(
                      imageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, error, stack) => fallback,
                    ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            email.isEmpty ? 'Student account' : email,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 17,
              height: 1.4,
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Your IntelliPrep space',
            style: TextStyle(color: Color(0xFFDBEBEF)),
          ),
          const SizedBox(height: 16),
          FilledButton.tonalIcon(
            onPressed: onTapAvatar,
            icon: const Icon(Icons.photo_camera_outlined),
            label: const Text('Change photo'),
          ),
        ],
      ),
    );
  }
}
