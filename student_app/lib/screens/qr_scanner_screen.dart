import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:http/http.dart' as http;

import '../api_constants.dart';
import 'exam_timer_screen.dart';
import '../ui/prep_ui.dart';

/// QRScannerScreen — UC2.2: Scan a QR code to unlock a timed exam session.
///
/// The student scans a QR code provided by their tutor. The code encodes a
/// session identifier (and optionally exam metadata as JSON). On a successful
/// scan the app navigates to [ExamTimerScreen] with the decoded session data.
class QRScannerScreen extends StatefulWidget {
  const QRScannerScreen({super.key});

  @override
  State<QRScannerScreen> createState() => _QRScannerScreenState();
}

class _QRScannerScreenState extends State<QRScannerScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    facing: CameraFacing.back,
  );
  bool _isProcessing = false;
  String? _lastError;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  // ── Barcode handler ────────────────────────────────────────────────

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_isProcessing) return;

    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final rawValue = barcodes.first.rawValue;
    if (rawValue == null || rawValue.isEmpty) return;

    setState(() => _isProcessing = true);

    // Stop the scanner to prevent repeat triggers and release hardware.
    await _controller.stop();

    await _navigateToExam(rawValue);
  }

  Future<void> _navigateToExam(String qrPayload) async {
    if (!mounted) return;

    // A valid IntelliPrep QR should start with "INTELLIPREP:"
    // For demo purposes we accept any non-empty string.
    final isValid = qrPayload.isNotEmpty;

    if (!isValid) {
      if (mounted) {
        setState(() {
          _lastError = 'Invalid QR code. Please scan an IntelliPrep exam code.';
          _isProcessing = false;
        });
        await _controller.start();
      }
      return;
    }

    try {
      String accessCode = qrPayload;
      if (qrPayload.startsWith('INTELLIPREP:')) {
        accessCode = qrPayload.substring('INTELLIPREP:'.length);
      }

      final url = ApiConstants.endpoint(
        'api/student/papers/join/${Uri.encodeComponent(accessCode)}',
      );
      final response = await http.get(url).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        if (!mounted) return;
        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => ExamTimerScreen(qrPayload: accessCode),
          ),
        );
      } else {
        if (!mounted) return;
        setState(() {
          _lastError =
              'Failed to join exam. Access Code: $accessCode, Status: ${response.statusCode}';
        });
      }
    } on TimeoutException {
      if (!mounted) return;
      setState(() {
        _lastError =
            'Could not connect to the server. Check your internet connection.';
        _isProcessing = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Could not connect to the server. Check your internet connection.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on SocketException {
      if (!mounted) return;
      setState(() {
        _lastError =
            'Could not connect to the server. Check your internet connection.';
        _isProcessing = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Could not connect to the server. Check your internet connection.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _lastError =
            'Could not connect to the server. Check your internet connection.';
        _isProcessing = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Could not connect to the server. Check your internet connection.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }

    if (mounted) {
      setState(() => _isProcessing = false);
      await _controller.start();
    }
  }

  void _toggleTorch() => _controller.toggleTorch();
  void _switchCamera() => _controller.switchCamera();

  // ── Build ──────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: PrepColors.navy,
    appBar: AppBar(
      backgroundColor: PrepColors.navy,
      foregroundColor: Colors.white,
      titleTextStyle: Theme.of(context).textTheme.titleLarge
          ?.copyWith(color: Colors.white),
      title: const Text(
        'Join an exam',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.flashlight_on_outlined),
          tooltip: 'Toggle torch',
          onPressed: _toggleTorch,
        ),
        IconButton(
          icon: const Icon(Icons.flip_camera_ios_outlined),
          tooltip: 'Switch camera',
          onPressed: _switchCamera,
        ),
      ],
    ),
    body: SafeArea(
      top: false,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final camera = ClipRRect(
            borderRadius: BorderRadius.circular(28),
            child: Stack(
              fit: StackFit.expand,
              children: [
                MobileScanner(controller: _controller, onDetect: _onDetect),
                IgnorePointer(child: _ScanOverlay(isProcessing: _isProcessing)),
                if (_isProcessing)
                  const ColoredBox(
                    color: Color(0xBB153D47),
                    child: Center(
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        semanticsLabel: 'Opening exam',
                      ),
                    ),
                  ),
              ],
            ),
          );
          final info = SingleChildScrollView(
            child: _BottomInfoPanel(
              isProcessing: _isProcessing,
              lastError: _lastError,
            ),
          );
          if (constraints.maxWidth > 600 &&
              constraints.maxWidth > constraints.maxHeight) {
            return Row(
              children: [
                Expanded(
                  flex: 3,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: camera,
                  ),
                ),
                Expanded(flex: 2, child: info),
              ],
            );
          }
          return Column(
            children: [
              Expanded(
                flex: 3,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: camera,
                ),
              ),
              Flexible(flex: 2, child: info),
            ],
          );
        },
      ),
    ),
  );
}

class _ScanOverlay extends StatelessWidget {
  const _ScanOverlay({required this.isProcessing});
  final bool isProcessing;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final side = constraints.biggest.shortestSide * 0.7;
      return Center(
        child: Container(
          width: side,
          height: side,
          decoration: BoxDecoration(
            border: Border.all(
              color: isProcessing ? const Color(0xFFD7F2B8) : Colors.white,
              width: 3,
            ),
            borderRadius: BorderRadius.circular(24),
            color: Colors.white.withAlpha(10),
          ),
        ),
      );
    },
  );
}

class _BottomInfoPanel extends StatelessWidget {
  const _BottomInfoPanel({required this.isProcessing, required this.lastError});
  final bool isProcessing;
  final String? lastError;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(24),
    child: Semantics(
      liveRegion: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PrepPill(
            'EXAM CHECK-IN',
            color: Color(0xFFD7F2B8),
            background: Color(0xFF30535C),
            icon: Icons.qr_code_scanner_rounded,
          ),
          const SizedBox(height: 16),
          Text(
            isProcessing ? 'Opening your exam…' : 'Point. Scan. You’re in.',
            style: Theme.of(context).textTheme.titleLarge
                ?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 10),
          if (lastError != null)
            _InfoChip(
              icon: Icons.error_outline_rounded,
              text: lastError!,
              color: const Color(0xFFFFB4AB),
            )
          else
            const _InfoChip(
              icon: Icons.info_outline_rounded,
              text: 'Position your tutor’s QR code inside the frame. Keep your phone steady and the code well lit.',
              color: Color(0xFFDBEBEF),
            ),
        ],
      ),
    ),
  );
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.icon,
    required this.text,
    required this.color,
  });
  final IconData icon;
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, color: color, size: 20),
      const SizedBox(width: 10),
      Expanded(
        child: Text(
          text,
          style: TextStyle(fontSize: 15, height: 1.5, color: color),
        ),
      ),
    ],
  );
}
