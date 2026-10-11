import 'package:flutter/material.dart';

/// Presentation primitives shared by the student screens.
abstract final class PrepColors {
  static const ink = Color(0xFF182A36);
  static const muted = Color(0xFF556773);
  static const primary = Color(0xFF146B61);
  static const navy = Color(0xFF153D47);
  static const canvas = Color(0xFFF5F7F8);
  static const line = Color(0xFFDCE4E7);
  static const mint = Color(0xFFE4F3EC);
  static const amber = Color(0xFF87520A);
  static const error = Color(0xFFB3261E);
}

ThemeData prepTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: PrepColors.primary).copyWith(
    primary: PrepColors.primary,
    onPrimary: Colors.white,
    secondary: PrepColors.navy,
    surface: Colors.white,
    onSurface: PrepColors.ink,
    error: PrepColors.error,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme);
  final outline = OutlineInputBorder(
    borderRadius: BorderRadius.circular(14),
    borderSide: const BorderSide(color: PrepColors.line),
  );
  return base.copyWith(
    scaffoldBackgroundColor: PrepColors.canvas,
    visualDensity: VisualDensity.standard,
    materialTapTargetSize: MaterialTapTargetSize.padded,
    textTheme: base.textTheme.copyWith(
      headlineLarge: const TextStyle(
        fontSize: 32,
        height: 1.15,
        fontWeight: FontWeight.w800,
        color: PrepColors.ink,
        letterSpacing: -0.8,
      ),
      headlineMedium: const TextStyle(
        fontSize: 28,
        height: 1.2,
        fontWeight: FontWeight.w700,
        color: PrepColors.ink,
        letterSpacing: -0.6,
      ),
      titleLarge: const TextStyle(
        fontSize: 22,
        height: 1.3,
        fontWeight: FontWeight.w700,
        color: PrepColors.ink,
      ),
      titleMedium: const TextStyle(
        fontSize: 17,
        height: 1.35,
        fontWeight: FontWeight.w700,
        color: PrepColors.ink,
      ),
      bodyLarge: const TextStyle(
        fontSize: 16,
        height: 1.5,
        color: PrepColors.ink,
      ),
      bodyMedium: const TextStyle(
        fontSize: 15,
        height: 1.45,
        color: PrepColors.muted,
      ),
      bodySmall: const TextStyle(
        fontSize: 13,
        height: 1.4,
        color: PrepColors.muted,
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: PrepColors.canvas,
      foregroundColor: PrepColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      toolbarHeight: 68,
      titleTextStyle: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: PrepColors.ink,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: PrepColors.canvas,
      border: outline,
      enabledBorder: outline,
      focusedBorder: outline.copyWith(
        borderSide: const BorderSide(color: PrepColors.primary, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      errorMaxLines: 4,
      helperMaxLines: 4,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 56),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 52),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        side: const BorderSide(color: PrepColors.line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(minimumSize: const Size(48, 48)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: PrepColors.mint,
      labelTextStyle: WidgetStateProperty.all(
        const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: PrepColors.navy,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      contentTextStyle: const TextStyle(fontSize: 15, color: Colors.white),
    ),
    dividerTheme: const DividerThemeData(color: PrepColors.line, thickness: 1),
  );
}

class PrepPage extends StatelessWidget {
  const PrepPage({
    super.key,
    required this.child,
    this.onRefresh,
    this.maxWidth = 760,
  });
  final Widget child;
  final Future<void> Function()? onRefresh;
  final double maxWidth;
  @override
  Widget build(BuildContext context) {
    final scroll = SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
      child: Center(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: SizedBox(width: double.infinity, child: child),
        ),
      ),
    );
    return SafeArea(
      top: false,
      child: onRefresh == null
          ? scroll
          : RefreshIndicator(onRefresh: onRefresh!, child: scroll),
    );
  }
}

class PrepCard extends StatelessWidget {
  const PrepCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.color = Colors.white,
    this.onTap,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color color;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: color,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(22),
      side: BorderSide(color: color == Colors.white ? PrepColors.line : color),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(padding: padding, child: child),
    ),
  );
}

class PrepHeading extends StatelessWidget {
  const PrepHeading({
    super.key,
    required this.title,
    this.subtitle,
    this.eyebrow,
  });
  final String title;
  final String? subtitle;
  final String? eyebrow;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (eyebrow != null) ...[
        Text(
          eyebrow!,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.3,
            color: PrepColors.primary,
          ),
        ),
        const SizedBox(height: 10),
      ],
      Semantics(
        header: true,
        child: Text(title, style: Theme.of(context).textTheme.headlineMedium),
      ),
      if (subtitle != null) ...[
        const SizedBox(height: 8),
        Text(subtitle!, style: Theme.of(context).textTheme.bodyMedium),
      ],
    ],
  );
}

class PrepSection extends StatelessWidget {
  const PrepSection({
    super.key,
    required this.title,
    this.action,
    this.onAction,
  });
  final String title;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 24, bottom: 12),
    child: Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 12,
      children: [
        Semantics(
          header: true,
          child: Text(title, style: Theme.of(context).textTheme.titleMedium),
        ),
        if (action != null)
          TextButton(onPressed: onAction, child: Text(action!)),
      ],
    ),
  );
}

class PrepPill extends StatelessWidget {
  const PrepPill(
    this.label, {
    super.key,
    this.icon,
    this.color = PrepColors.primary,
    this.background = PrepColors.mint,
  });
  final String label;
  final IconData? icon;
  final Color color;
  final Color background;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    decoration: BoxDecoration(
      color: background,
      borderRadius: BorderRadius.circular(10),
    ),
    child: Text.rich(
      TextSpan(
        children: [
          if (icon != null)
            WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Icon(icon, size: 16, color: color),
              ),
            ),
          TextSpan(text: label),
        ],
      ),
      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: color),
    ),
  );
}

class PrepState extends StatelessWidget {
  const PrepState({
    super.key,
    required this.title,
    this.message,
    this.icon = Icons.auto_stories_outlined,
    this.loading = false,
    this.action,
    this.onAction,
  });
  final String title;
  final String? message;
  final IconData icon;
  final bool loading;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: PrepCard(
      child: Column(
        children: [
          if (loading)
            SizedBox(
              width: 28,
              height: 28,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                semanticsLabel: title,
              ),
            )
          else
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: PrepColors.mint,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: PrepColors.primary, size: 28),
            ),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (message != null) ...[
            const SizedBox(height: 8),
            Text(message!, textAlign: TextAlign.center),
          ],
          if (action != null) ...[
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onAction, child: Text(action!)),
          ],
        ],
      ),
    ),
  );
}

class PrepAction extends StatelessWidget {
  const PrepAction({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => PrepCard(
    onTap: onTap,
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: PrepColors.mint,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, color: PrepColors.primary),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(subtitle),
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.only(top: 12),
          child: Icon(Icons.chevron_right_rounded, color: PrepColors.muted),
        ),
      ],
    ),
  );
}

class PrepMetrics extends StatelessWidget {
  const PrepMetrics({super.key, required this.items});
  final List<Widget> items;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final columns =
          constraints.maxWidth >= 480 &&
              MediaQuery.textScalerOf(context).scale(16) < 25
          ? items.length
          : constraints.maxWidth >= 290 &&
                MediaQuery.textScalerOf(context).scale(16) < 25
          ? 2
          : 1;
      final width = (constraints.maxWidth - 12 * (columns - 1)) / columns;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: items
            .map((item) => SizedBox(width: width, child: item))
            .toList(),
      );
    },
  );
}

class PrepMetric extends StatelessWidget {
  const PrepMetric({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
  });
  final String label;
  final String value;
  final IconData icon;
  @override
  Widget build(BuildContext context) => PrepCard(
    padding: const EdgeInsets.all(16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: PrepColors.primary, size: 22),
        const SizedBox(height: 14),
        Text(value, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 4),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    ),
  );
}

class PrepBusyLabel extends StatelessWidget {
  const PrepBusyLabel(this.label, {super.key});
  final String label;
  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Wrap(
      spacing: 10,
      crossAxisAlignment: WrapCrossAlignment.center,
      alignment: WrapAlignment.center,
      children: [
        const SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: PrepColors.primary,
          ),
        ),
        Text(label),
      ],
    ),
  );
}
