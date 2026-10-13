import 'package:flutter/material.dart';
import '../ui/prep_ui.dart';

/// HowToUseScreen — a step-by-step onboarding guide that walks new students
/// through the key features of the IntelliPrep student app.
class HowToUseScreen extends StatelessWidget {
  const HowToUseScreen({super.key});

  // ── Step definitions ────────────────────────────────────────────────────
  static const _steps = [
    _GuideStep(
      number: 1,
      icon: Icons.login_rounded,
      title: 'Sign In to Your Account',
      description:
          'Open the app and enter the email and password issued for your '
          'student account. Tap "Sign in" to access IntelliPrep. '
          'Use "Forgot password?" to reset your credentials if needed.',
      accentColor: Color(0xFF146B61),
      bgColor: Color(0xFFE4F3EC),
    ),
    _GuideStep(
      number: 2,
      icon: Icons.home_rounded,
      title: 'Explore Your Dashboard',
      description:
          'The Dashboard gives you a quick snapshot of your learning '
          'journey — recent exam results, your average score, and a '
          'shortcut to your next study topic. Check here every session.',
      accentColor: Color(0xFF153D47),
      bgColor: Color(0xFFDCEFF4),
    ),
    _GuideStep(
      number: 3,
      icon: Icons.qr_code_scanner_rounded,
      title: 'Join an Exam via QR Code',
      description:
          'When your tutor displays a QR code to start an exam, tap '
          '"Scan to join exam" on the Dashboard. Point your camera at '
          'the code and you\'ll be placed into the exam immediately.',
      accentColor: Color(0xFF87520A),
      bgColor: Color(0xFFFFF2DE),
    ),
    _GuideStep(
      number: 4,
      icon: Icons.timer_outlined,
      title: 'Complete Your Exam',
      description:
          'Read each multiple-choice question carefully and select your '
          'answer before the timer expires. Your progress is saved locally '
          'on-device, so a brief network drop won\'t lose your work.',
      accentColor: Color(0xFF146B61),
      bgColor: Color(0xFFE4F3EC),
    ),
    _GuideStep(
      number: 5,
      icon: Icons.insights_rounded,
      title: 'Review Your Results',
      description:
          'After submission, open the Progress tab to view your score, '
          'Pass / Fail badge, and a full answer review. Tap any result '
          'card to revisit each question and learn from your mistakes.',
      accentColor: Color(0xFF153D47),
      bgColor: Color(0xFFDCEFF4),
    ),
    _GuideStep(
      number: 6,
      icon: Icons.auto_stories_rounded,
      title: 'Follow Your Study Plan',
      description:
          'The Study Plan tab shows your AI-generated day-by-day topic '
          'schedule. Study one topic per day — the Dashboard always '
          'highlights your very next task so you know what to focus on.',
      accentColor: Color(0xFF87520A),
      bgColor: Color(0xFFFFF2DE),
    ),
    _GuideStep(
      number: 7,
      icon: Icons.person_outline_rounded,
      title: 'Manage Your Profile',
      description:
          'Tap the profile icon (top-right) to update your full name, '
          'phone number, address, college, and profile photo. You can '
          'also change your password securely from the profile screen.',
      accentColor: Color(0xFF146B61),
      bgColor: Color(0xFFE4F3EC),
    ),
  ];

  // ── Build ────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('How to Use IntelliPrep')),
    body: PrepPage(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Hero header card ───────────────────────────────────────────
          PrepCard(
            color: PrepColors.navy,
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white.withAlpha(25),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.school_rounded,
                    color: Color(0xFFD7F2B8),
                    size: 34,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Your IntelliPrep\nQuick-Start Guide',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: Colors.white,
                    height: 1.25,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Follow these 7 steps to make the most of IntelliPrep '
                  'and build confidence for your A/L ICT exam.',
                  style: TextStyle(
                    color: Color(0xFFDBEBEF),
                    fontSize: 15,
                    height: 1.55,
                  ),
                ),
                const SizedBox(height: 20),
                const PrepPill(
                  '7 simple steps',
                  icon: Icons.checklist_rounded,
                  color: Color(0xFFD7F2B8),
                  background: Color(0xFF1E5260),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ── Step cards ─────────────────────────────────────────────────
          ...List.generate(_steps.length, (i) {
            final isLast = i == _steps.length - 1;
            return Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
              child: _StepCard(step: _steps[i]),
            );
          }),

          const SizedBox(height: 16),

          // ── Footer tip ─────────────────────────────────────────────────
          PrepCard(
            color: PrepColors.mint,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: PrepColors.primary.withAlpha(20),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.lightbulb_outline_rounded,
                    color: PrepColors.primary,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'You\'re all set!',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Head back to the Dashboard and scan your first '
                        'exam QR code. Good luck with your A/L ICT prep!',
                        style: TextStyle(height: 1.5),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

// ── Step data model ──────────────────────────────────────────────────────────

class _GuideStep {
  const _GuideStep({
    required this.number,
    required this.icon,
    required this.title,
    required this.description,
    required this.accentColor,
    required this.bgColor,
  });
  final int number;
  final IconData icon;
  final String title;
  final String description;
  final Color accentColor;
  final Color bgColor;
}

// ── Step card ────────────────────────────────────────────────────────────────

class _StepCard extends StatelessWidget {
  const _StepCard({required this.step});
  final _GuideStep step;

  @override
  Widget build(BuildContext context) => PrepCard(
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Left: icon + step number ─────────────────────────────────────
        Column(
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: step.bgColor,
                borderRadius: BorderRadius.circular(15),
              ),
              child: Icon(step.icon, color: step.accentColor, size: 27),
            ),
            const SizedBox(height: 7),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: step.bgColor,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Step ${step.number}',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: step.accentColor,
                  letterSpacing: 0.3,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(width: 16),

        // ── Right: title + description ────────────────────────────────────
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step.title,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  step.description,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    height: 1.55,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}
