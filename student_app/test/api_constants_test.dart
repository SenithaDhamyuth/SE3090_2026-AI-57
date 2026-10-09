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
}
