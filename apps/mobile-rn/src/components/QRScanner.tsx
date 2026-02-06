import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from "react-native-vision-camera";
import { colors } from "../styles/theme";

interface QRScannerProps {
  onScanned: (data: string) => void;
}

export function QRScanner({ onScanned }: QRScannerProps) {
  const device = useCameraDevice("back");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannedRef = useRef(false);

  React.useEffect(() => {
    Camera.requestCameraPermission().then((status) => {
      setHasPermission(status === "granted");
    });
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ["qr"],
    onCodeScanned: useCallback(
      (codes) => {
        if (scannedRef.current) return;
        const qrCode = codes.find((c) => c.type === "qr" && c.value);
        if (qrCode?.value) {
          scannedRef.current = true;
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
        isActive={true}
        codeScanner={codeScanner}
      />
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
      </View>
      <Text style={styles.hint}>point camera at the receiver's QR code</Text>
    </View>
  );
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
});
