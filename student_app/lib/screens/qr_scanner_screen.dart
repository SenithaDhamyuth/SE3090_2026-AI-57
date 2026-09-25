import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'exam_timer_screen.dart';

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
  final TextEditingController _backendIpController = TextEditingController();

  bool _isProcessing = false;
  String? _lastError;

  @override
  void dispose() {
    _controller.dispose();
    _backendIpController.dispose();
    super.dispose();
  }

  // ── Barcode handler ────────────────────────────────────────────────

  void _onDetect(BarcodeCapture capture) {
    if (_isProcessing) return;

    final barcodes = capture.barcodes;
    if (barcodes.isEmpty) return;

    final rawValue = barcodes.first.rawValue;
    if (rawValue == null || rawValue.isEmpty) return;

    setState(() => _isProcessing = true);

    // Stop the scanner to prevent repeat triggers
    _controller.stop();

    _navigateToExam(rawValue);
  }

  void _navigateToExam(String qrPayload) {
    if (!mounted) return;

    // A valid IntelliPrep QR should start with "INTELLIPREP:"
    // For demo purposes we accept any non-empty string.
    final isValid = qrPayload.isNotEmpty;

    if (!isValid) {
      setState(() {
        _lastError = 'Invalid QR code. Please scan an IntelliPrep exam code.';
        _isProcessing = false;
      });
      _controller.start();
      return;
    }

    // Navigate and pass the QR payload as the session identifier
    Navigator.of(context)
        .push(
          MaterialPageRoute<void>(
            builder: (_) => ExamTimerScreen(qrPayload: qrPayload),
          ),
        )
        .then((_) {
          // Resume scanner if user comes back from the exam screen
          if (mounted) {
            setState(() => _isProcessing = false);
            _controller.start();
          }
        });
  }

  void _toggleTorch() => _controller.toggleTorch();
  void _switchCamera() => _controller.switchCamera();

  void _showBackendIpDialog() {
    SharedPreferences.getInstance().then((prefs) {
      if (!mounted) return;

      final savedIp = prefs.getString('backend_ip') ?? '192.168.1.146';
      final messenger = ScaffoldMessenger.maybeOf(context);
      _backendIpController.text = savedIp;

      showDialog<String>(
        context: context,
        builder: (builderContext) => AlertDialog(
          title: const Text('Backend IP Settings'),
          content: SizedBox(
            width: 300,
            child: TextField(
              controller: _backendIpController,
              autofocus: true,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(
                labelText: 'Backend IP',
                hintText: '192.168.1.146',
                border: OutlineInputBorder(),
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(builderContext).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(builderContext).pop(_backendIpController.text),
              child: const Text('Save'),
            ),
          ],
        ),
      ).then((newIp) async {
        if (!mounted) return;

        final trimmedIp = (newIp ?? '').trim();
        if (trimmedIp.isEmpty) {
          messenger?.showSnackBar(
            const SnackBar(content: Text('Backend IP cannot be empty.')),
          );
          return;
        }

        final normalizedIp = trimmedIp.replaceFirst(RegExp(r'^https?://'), '').trim();
        await prefs.setString('backend_ip', normalizedIp);
        messenger?.showSnackBar(
          SnackBar(content: Text('Backend IP saved: $normalizedIp')),
        );
      });
    });
  }

  // ── Build ──────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white, size: 28),
        actionsIconTheme: const IconThemeData(color: Colors.white, size: 28),
        title: const Text(
          'Scan Exam QR Code',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            color: Colors.black,
            tooltip: 'Backend IP settings',
            onPressed: _showBackendIpDialog,
          ),
          // Torch toggle
          IconButton(
            icon: const Icon(Icons.flashlight_on_outlined),
            tooltip: 'Toggle torch',
            onPressed: _toggleTorch,
          ),
          // Camera flip
          IconButton(
            icon: const Icon(Icons.flip_camera_ios_outlined),
            tooltip: 'Switch camera',
            onPressed: _switchCamera,
          ),
        ],
      ),
      body: Stack(
        children: [
          // ── Camera preview ──────────────────────────────────────────
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),

          // ── Scanning overlay ────────────────────────────────────────
          _ScanOverlay(isProcessing: _isProcessing),

          // ── Bottom info panel ───────────────────────────────────────
          Align(
            alignment: Alignment.bottomCenter,
            child: _BottomInfoPanel(
              isProcessing: _isProcessing,
              lastError: _lastError,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Private overlay widget ─────────────────────────────────────────────────

class _ScanOverlay extends StatelessWidget {
  const _ScanOverlay({required this.isProcessing});

  final bool isProcessing;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Viewfinder frame
          Container(
            width: 240,
            height: 240,
            decoration: BoxDecoration(
              border: Border.all(
                color: isProcessing ? Colors.green : Colors.orange,
                width: 3,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: isProcessing
                ? const Center(
                    child: CircularProgressIndicator(
                      color: Colors.green,
                      strokeWidth: 3,
                    ),
                  )
                : null,
          ),
          const SizedBox(height: 20),
          // Corner accent lines using a CustomPaint
          Text(
            isProcessing ? 'Unlocking exam…' : 'Point at the exam QR code',
            style: TextStyle(
              color: isProcessing ? Colors.green : Colors.white70,
              fontSize: 13,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Bottom info panel ──────────────────────────────────────────────────────

class _BottomInfoPanel extends StatelessWidget {
  const _BottomInfoPanel({
    required this.isProcessing,
    required this.lastError,
  });

  final bool isProcessing;
  final String? lastError;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 36),
      decoration: const BoxDecoration(
        color: Colors.black87,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title row
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.orange.withAlpha(40),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.orange.withAlpha(80)),
                ),
                child: const Icon(Icons.qr_code_scanner,
                    color: Colors.orange, size: 18),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'IntelliPrep Exam Unlock',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      'UC2.2 · A/L ICT Assessment',
                      style: TextStyle(
                        color: Colors.white38,
                        fontSize: 10,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Instructions / error
          if (lastError != null)
            _InfoChip(
              icon: Icons.error_outline,
              text: lastError!,
              color: Colors.red,
            )
          else
            const _InfoChip(
              icon: Icons.info_outline,
              text: 'Your tutor will display the QR code at the start of the exam.',
              color: Colors.white54,
            ),
        ],
      ),
    );
  }
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
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 14),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            style: TextStyle(color: color, fontSize: 12, height: 1.4),
          ),
        ),
      ],
    );
  }
}
