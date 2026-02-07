/**
 * platform-adaptive QR scanner.
 * - mobile: uses react-native-vision-camera
 * - web/electron: uses html5-qrcode (camera via getUserMedia)
 */

import React, { useCallback, useRef, useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { colors } from "../styles/theme";

interface QRScannerProps {
  onScanned: (data: string) => void;
}

/**
 * mobile QR scanner using react-native-vision-camera.
 */
function MobileQRScanner({ onScanned }: QRScannerProps) {
  // dynamic import to avoid pulling native modules into web bundle
  const [VisionCamera, setVisionCamera] = useState<any>(null);
  const scannedRef = useRef(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    let mounted = true;
    import("react-native-vision-camera").then((mod) => {
      if (mounted) setVisionCamera(mod);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!VisionCamera) return;
    VisionCamera.Camera.requestCameraPermission().then((status: string) => {
      setHasPermission(status === "granted");
    });
  }, [VisionCamera]);

  const handleReset = useCallback(() => {
    scannedRef.current = false;
    setShowRetry(false);
  }, []);

  if (!VisionCamera || hasPermission === null) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>requesting camera access...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          camera access denied. enable it in settings to scan QR codes.
        </Text>
      </View>
    );
  }

  const { Camera, useCameraDevice, useCodeScanner } = VisionCamera;

  return (
    <MobileCameraView
      Camera={Camera}
      useCameraDevice={useCameraDevice}
      useCodeScanner={useCodeScanner}
      scannedRef={scannedRef}
      showRetry={showRetry}
      setShowRetry={setShowRetry}
      onScanned={onScanned}
      handleReset={handleReset}
    />
  );
}

// separate component to use hooks from vision-camera
function MobileCameraView({
  Camera,
  useCameraDevice,
  useCodeScanner,
  scannedRef,
  showRetry,
  setShowRetry,
  onScanned,
  handleReset,
}: any) {
  const device = useCameraDevice("back");

  const codeScanner = useCodeScanner({
    codeTypes: ["qr"],
    onCodeScanned: (codes: any[]) => {
      if (scannedRef.current) return;
      const qrCode = codes.find((c: any) => c.type === "qr" && c.value);
      if (qrCode?.value) {
        scannedRef.current = true;
        setShowRetry(true);
        onScanned(qrCode.value);
      }
    },
  });

  if (!device) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>no camera found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!scannedRef.current}
        codeScanner={codeScanner}
      />
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
      </View>
      {showRetry ? (
        <TouchableOpacity style={styles.retryButton} onPress={handleReset}>
          <Text style={styles.retryText}>tap to scan again</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.hint}>point camera at QR code</Text>
      )}
    </View>
  );
}

/**
 * web/electron QR scanner using html5-qrcode.
 */
function WebQRScanner({ onScanned }: QRScannerProps) {
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<string>("qr-scanner-" + Date.now());
  const [error, setError] = useState<string | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (!mounted) return;

      const scanner = new Html5Qrcode(containerRef.current);
      scannerRef.current = scanner;

      scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        (decodedText: string) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          onScanned(decodedText);
          scanner.stop().catch(() => {});
        },
        () => {},
      ).catch((err: Error) => {
        if (mounted) setError(err.message);
      });
    });

    return () => {
      mounted = false;
      scannerRef.current?.stop().catch(() => {});
    };
  }, [onScanned]);

  if (error) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        nativeID={containerRef.current}
        style={{ width: 280, height: 280 }}
      />
    </View>
  );
}

export function QRScanner(props: QRScannerProps) {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return <MobileQRScanner {...props} />;
  }
  return <WebQRScanner {...props} />;
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: 280,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 12,
  },
  placeholder: {
    width: 280,
    height: 280,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  hint: {
    position: "absolute",
    bottom: -28,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 12,
    color: colors.textSecondary,
  },
  retryButton: {
    position: "absolute",
    bottom: -36,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  retryText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
  },
});
