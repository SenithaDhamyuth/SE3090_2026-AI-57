class ApiConstants {
  static const String baseUrl = 'https://intelliprep-rhx3.onrender.com';

  static Uri endpoint(String path) => Uri.parse('$baseUrl/$path');
}