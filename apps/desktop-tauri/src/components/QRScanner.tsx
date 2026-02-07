import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import jsQR from "jsqr";
import { colors } from "../styles/theme";

interface QRScannerProps {
  onScanned: (data: string) => void;
}

export function QRScanner({ onScanned }: QRScannerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const onScannedRef = useRef(onScanned);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  // keep callback ref fresh to avoid stale closures
  onScannedRef.current = onScanned;

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: 640, height: 480 },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStarted(true);
          scanFrames();
        }
      } catch {
        if (!cancelled) {
          setError(t("camera.error"));
        }
      }
    }

    function scanFrames() {
      if (!scanningRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code?.data) {
        scanningRef.current = false;
        onScannedRef.current(code.data);
        return;
      }

      rafRef.current = requestAnimationFrame(scanFrames);
    }

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 280,
          height: 280,
          borderRadius: 16,
          overflow: "hidden",
          background: colors.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <video
          ref={videoRef}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: started ? "block" : "none",
          }}
          playsInline
          muted
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {!started && !error && (
          <p style={{ fontSize: 13, color: colors.textSecondary }}>
            {t("camera.starting")}
          </p>
        )}
        {error && (
          <p
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              textAlign: "center",
              padding: 16,
            }}
          >
            {error}
          </p>
        )}
      </div>
      <p style={{ fontSize: 12, color: colors.textSecondary }}>
        {t("camera.hint")}
      </p>
    </div>
  );
}
