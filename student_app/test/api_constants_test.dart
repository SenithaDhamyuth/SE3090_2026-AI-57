import 'package:flutter_test/flutter_test.dart';
import 'package:student_app/api_constants.dart';

void main() {
  group('ApiConstants.normalizeEmail', () {
    test('trims surrounding whitespace and normalizes capitalization', () {
      expect(
        ApiConstants.normalizeEmail('  Student.Name@Example.COM  '),
        'student.name@example.com',
      );
    });

    test('preserves the local-part punctuation', () {
      expect(
        ApiConstants.normalizeEmail('First.Last+ICT@Example.com'),
        'first.last+ict@example.com',
      );
    });
  });

  group('ApiConstants.resolveUrl', () {
    test('resolves a leading-slash path against the API base URL', () {
      expect(
        ApiConstants.resolveUrl('/uploads/profile.jpg').toString(),
        '${ApiConstants.baseUrl}/uploads/profile.jpg',
      );
    });

    test('preserves an already absolute image URL', () {
      const imageUrl = 'https://cdn.example.com/profile.jpg';

      expect(ApiConstants.resolveUrl(imageUrl).toString(), imageUrl);
    });
  });
}
