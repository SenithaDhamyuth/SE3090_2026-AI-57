class ApiConstants {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://intelliprep-rhx3.onrender.com',
  );

  static Uri endpoint(String path) {
    final normalizedBase = baseUrl.replaceFirst(RegExp(r'/+$'), '');
    final normalizedPath = path.replaceFirst(RegExp(r'^/+'), '');
    return Uri.parse('$normalizedBase/$normalizedPath');
  }

  static String normalizeEmail(String email) => email.trim().toLowerCase();
}