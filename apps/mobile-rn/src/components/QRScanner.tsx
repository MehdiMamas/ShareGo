import React, { useCallback, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from "react-native-vision-camera";
import { colors } from "../styles/theme";

export interface QRScannerRef {
  reset: () => void;
}

interface QRScannerProps {
  onScanned: (data: string) => void;
}

export const QRScanner = forwardRef<QRScannerRef, QRScannerProps>(
  function QRScanner({ onScanned }, ref) {
  const device = useCameraDevice("back");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannedRef = useRef(false);
  const [showRetry, setShowRetry] = useState(false);

  useImperativeHandle(ref, () => ({
    reset: () => {
      scannedRef.current = false;
      setShowRetry(false);
    },
  }));

  React.useEffect(() => {
    Camera.requestCameraPermission().then((status) => {
      setHasPermission(status === "granted");
    });
  }, []);

  const handleReset = useCallback(() => {
    scannedRef.current = false;
    setShowRetry(false);
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ["qr"],
    onCodeScanned: useCallback(
      (codes) => {
        if (scannedRef.current) return;
        const qrCode = codes.find((c) => c.type === "qr" && c.value);
        if (qrCode?.value) {
          scannedRef.current = true;
          setShowRetry(true);
          onScanned(qrCode.value);
        }
      },
      [onScanned],
    ),
  });

  if (hasPermission === null) {
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
        <Text style={styles.hint}>point camera at the receiver's QR code</Text>
      )}
    </View>
  );
});

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
