/**
 * platform-adaptive QR scanner.
 * - mobile: uses react-native-vision-camera
 * - web/electron: uses html5-qrcode (camera via getUserMedia)
 */

import React, { useCallback, useRef, useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { en, log } from "../lib/core";
import { colors } from "../styles/theme";

interface QRScannerProps {
  onScanned: (data: string) => void;
}

/** dynamically imported vision-camera module shape */
interface VisionCameraModule {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Camera: any;
  useCameraDevice: (position: unknown) => unknown;
  useCodeScanner: (opts: CodeScannerOptions) => unknown;
}

interface CodeScannerOptions {
  codeTypes: string[];
  onCodeScanned: (codes: ScannedCode[]) => void;
}

interface ScannedCode {
  type: string;
  value?: string;
}

interface MobileCameraViewProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Camera: any;
  useCameraDevice: (position: unknown) => unknown;
  useCodeScanner: (opts: CodeScannerOptions) => unknown;
  scannedRef: React.MutableRefObject<boolean>;
  showRetry: boolean;
  setShowRetry: (v: boolean) => void;
  onScanned: (data: string) => void;
  handleReset: () => void;
}

interface Html5QrScanner {
  start: (
    cameraIdOrConfig: unknown,
    config: unknown,
    onSuccess: (text: string) => void,
    onError: () => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * mobile QR scanner using react-native-vision-camera.
 */
function MobileQRScanner({ onScanned }: QRScannerProps) {
  // dynamic import to avoid pulling native modules into web bundle
  const [VisionCamera, setVisionCamera] = useState<VisionCameraModule | null>(null);
  const scannedRef = useRef(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    let mounted = true;
    import("react-native-vision-camera").then((mod) => {
      if (mounted) setVisionCamera(mod as unknown as VisionCameraModule);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!VisionCamera) return;
    (VisionCamera.Camera as any).requestCameraPermission().then((status: string) => {
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
        <Text style={styles.placeholderText}>{en.camera.requesting}</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>{en.camera.denied}</Text>
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
}: MobileCameraViewProps) {
  const device = useCameraDevice("back");

  const codeScanner = useCodeScanner({
    codeTypes: ["qr"],
    onCodeScanned: (codes: ScannedCode[]) => {
      if (scannedRef.current) return;
      const qrCode = codes.find((c) => c.type === "qr" && c.value);
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
        <Text style={styles.placeholderText}>{en.camera.notFound}</Text>
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
          <Text style={styles.retryText}>{en.camera.retryHint}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.hint}>{en.camera.hint}</Text>
      )}
    </View>
  );
}

/**
 * web/electron QR scanner using html5-qrcode.
 */
function WebQRScanner({ onScanned }: QRScannerProps) {
  const scannerRef = useRef<Html5QrScanner | null>(null);
  const containerRef = useRef<string>("qr-scanner-" + Date.now());
  const [error, setError] = useState<string | null>(null);
  const scannedRef = useRef(false);
  // use a ref for the callback so the effect doesn't re-run when onScanned changes identity
  const onScannedRef = useRef(onScanned);
  onScannedRef.current = onScanned;
  const startedRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    // wait for the DOM container to be rendered before html5-qrcode tries to use it
    const waitForContainer = new Promise<void>((resolve) => {
      const el = document.getElementById(containerRef.current);
      if (el) {
        resolve();
        return;
      }
      const observer = new MutationObserver(() => {
        if (document.getElementById(containerRef.current)) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      // safety timeout in case observer never fires
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 1000);
    });

    waitForContainer
      .then(() => import("html5-qrcode"))
      .then(({ Html5Qrcode }) => {
        if (!mounted) return;

        const scanner = new Html5Qrcode(containerRef.current);
        scannerRef.current = scanner as unknown as Html5QrScanner;

        const onSuccess = (decodedText: string) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          onScannedRef.current(decodedText);
          try {
            scanner.stop().catch((e: unknown) => log.warn("[qr] stop failed:", e));
          } catch (e) {
            log.warn("[qr] stop threw:", e);
          }
        };
        const onFailure = () => {};
        const config = { fps: 10, qrbox: { width: 200, height: 200 } };

        // try environment camera first, fall back to user camera (desktop macs have no rear cam)
        scanner
          .start({ facingMode: "environment" }, config, onSuccess, onFailure)
          .then(() => {
            startedRef.current = true;
          })
          .catch(() => {
            if (!mounted) return;
            return scanner.start({ facingMode: "user" }, config, onSuccess, onFailure).then(() => {
              startedRef.current = true;
            });
          })
          .catch((err: Error) => {
            if (mounted) setError(err.message);
          });
      })
      .catch(() => {
        if (mounted) setError("failed to load QR scanner");
      });

    return () => {
      mounted = false;
      // stop the html5-qrcode scanner
      if (startedRef.current && scannerRef.current) {
        try {
          scannerRef.current.stop().catch((e: unknown) => log.warn("[qr] cleanup stop failed:", e));
        } catch (e) {
          log.warn("[qr] cleanup stop threw:", e);
        }
      }
      // force-release all camera tracks in case html5-qrcode doesn't
      try {
        const videos = document.querySelectorAll("video");
        videos.forEach((video) => {
          const stream = (video as HTMLVideoElement).srcObject as MediaStream | null;
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            (video as HTMLVideoElement).srcObject = null;
          }
        });
      } catch (e) {
        log.warn("[qr] camera track cleanup failed:", e);
      }
    };
  }, []); // no deps — mount once, use refs for callbacks

  if (error) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View nativeID={containerRef.current} style={{ width: 280, height: 280 }} />
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
