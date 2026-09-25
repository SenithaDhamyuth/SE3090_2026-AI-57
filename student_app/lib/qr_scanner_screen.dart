import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'screens/exam_timer_screen.dart';

class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
  );

  bool isScanning = true;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleDetect(BarcodeCapture capture) {
    if (!isScanning) return;

    final rawValue = capture.barcodes.first.rawValue;
    if (rawValue == null || rawValue.isEmpty) return;

    setState(() {
      isScanning = false;
    });

    _controller.stop();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Scanned Session ID: $rawValue'),
        behavior: SnackBarBehavior.floating,
      ),
    );

    Navigator.of(context)
        .push(
          MaterialPageRoute<void>(
            builder: (_) => ExamTimerScreen(qrPayload: rawValue),
          ),
        )
        .then((_) {
          if (!mounted) return;
          setState(() => isScanning = true);
          _controller.start();
        });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('IntelliPrep Scanner'),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on),
            onPressed: () => _controller.toggleTorch(),
            tooltip: 'Toggle flashlight',
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _handleDetect,
          ),
          Center(
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: Colors.greenAccent,
                  width: 3,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.green.withValues(alpha: 0.18),
                    blurRadius: 20,
                    spreadRadius: 4,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
