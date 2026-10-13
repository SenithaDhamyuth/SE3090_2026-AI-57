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

  static Uri resolveUrl(String path) {
    final uri = Uri.parse(path);
    if (uri.hasScheme) return uri;
    return endpoint(path);
  }

  static String normalizeEmail(String email) => email.trim().toLowerCase();
}