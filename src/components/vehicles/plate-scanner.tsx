"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  extractPlateFromText,
  preprocessPlateImage,
} from "@/lib/plate-ocr";
import { Button } from "@/components/ui/button";

type PlateScannerProps = {
  onPlateDetected: (plate: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  className?: string;
};

type ScanPhase = "idle" | "camera" | "processing";

function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  );
}

async function requestCameraStream(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: { ideal: "environment" } }, audio: false },
    { video: { facingMode: "user" }, audio: false },
    { video: true, audio: false },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("Câmera indisponível");
}

export function PlateScanner({
  onPlateDetected,
  onError,
  disabled,
  className,
}: PlateScannerProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mounted, setMounted] = useState(false);
  const [touchDevice, setTouchDevice] = useState(false);

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setTouchDevice(isTouchDevice());
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (phase !== "camera" || !cameraStream) return;

    const video = videoRef.current;
    if (!video) return;

    video.srcObject = cameraStream;
    video.muted = true;

    void video
      .play()
      .then(() => setCameraError(null))
      .catch(() => {
        setCameraError("Não foi possível exibir a câmera. Use a galeria abaixo.");
      });
  }, [phase, cameraStream]);

  const reportError = useCallback(
    (message: string) => {
      onError?.(message);
    },
    [onError]
  );

  const runOcr = useCallback(
    async (file: Blob) => {
      setPhase("processing");
      setProgress(0);

      const url = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      try {
        const processed = await preprocessPlateImage(file);
        const Tesseract = (await import("tesseract.js")).default;
        const worker = await Tesseract.createWorker("eng", 1, {
          logger: (m) => {
            if (m.status === "recognizing text" && typeof m.progress === "number") {
              setProgress(Math.round(m.progress * 100));
            }
          },
        });

        await worker.setParameters({
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
        });

        const { data } = await worker.recognize(processed);
        await worker.terminate();

        const plate = extractPlateFromText(data.text);
        if (!plate) {
          reportError(
            "Não conseguimos ler a placa. Tente de novo com a placa centralizada e boa luz, ou digite manualmente."
          );
          setPhase("idle");
          return;
        }

        onPlateDetected(plate);
        setPhase("idle");
      } catch {
        reportError("Erro ao processar a foto. Tente novamente ou digite a placa.");
        setPhase("idle");
      }
    },
    [onPlateDetected, reportError]
  );

  async function handleFile(file: File | null | undefined) {
    if (!file || disabled) return;
    await runOcr(file);
  }

  function openNativeCamera() {
    fileInputRef.current?.click();
  }

  async function openLiveCamera() {
    if (disabled || cameraStarting) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      openNativeCamera();
      return;
    }

    setCameraStarting(true);
    setCameraError(null);

    try {
      const stream = await requestCameraStream();
      streamRef.current = stream;
      setCameraStream(stream);
      setPhase("camera");
    } catch {
      openNativeCamera();
    } finally {
      setCameraStarting(false);
    }
  }

  async function openCamera() {
    if (disabled) return;

    // No celular, a câmera nativa do sistema é mais confiável que preview no navegador.
    if (isTouchDevice()) {
      openNativeCamera();
      return;
    }

    await openLiveCamera();
  }

  function closeCamera() {
    stopCamera();
    setPhase("idle");
    setCameraError(null);
  }

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setCameraError("Aguarde a câmera carregar ou use a galeria.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    closeCamera();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
    );
    if (blob) await runOcr(blob);
  }

  const busy = phase === "processing" || disabled || cameraStarting;

  const cameraOverlay =
    phase === "camera" ? (
      <div className="fixed inset-0 z-[300] flex flex-col bg-black">
        <div className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
          <p className="font-medium">Enquadre a placa</p>
          <button
            type="button"
            aria-label="Fechar câmera"
            className="rounded-lg p-2 hover:bg-white/10 touch-manipulation"
            onClick={closeCamera}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
            <div className="h-16 w-full max-w-xs rounded-lg border-2 border-dashed border-white/80 bg-black/20" />
          </div>
          {cameraStarting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              Abrindo câmera…
            </div>
          )}
        </div>

        {cameraError && (
          <p className="bg-red-950/80 px-4 py-2 text-center text-sm text-red-200">
            {cameraError}
          </p>
        )}

        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            className="h-14 w-full text-base"
            disabled={cameraStarting}
            onClick={() => void captureFromCamera()}
          >
            Capturar placa
          </Button>
          <button
            type="button"
            className="mt-3 w-full text-center text-sm text-white/80 underline touch-manipulation"
            onClick={openNativeCamera}
          >
            Ou escolher da galeria
          </button>
        </div>
      </div>
    ) : null;

  return (
    <>
      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleFile(file);
          e.target.value = "";
        }}
      />

      <div className={cn("space-y-2", className)}>
        <Button
          type="button"
          variant="secondary"
          className="h-12 w-full gap-2 text-base touch-manipulation sm:h-11"
          disabled={busy}
          onClick={() => void openCamera()}
        >
          {phase === "processing" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Lendo placa… {progress > 0 ? `${progress}%` : ""}
            </>
          ) : cameraStarting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Abrindo câmera…
            </>
          ) : (
            <>
              <Camera className="h-5 w-5" />
              Fotografar placa
            </>
          )}
        </Button>

        <p className="text-center text-xs text-slate-500 sm:text-left">
          {touchDevice
            ? "Abre a câmera do celular. Centralize a placa com boa luz."
            : "Aponte para a placa com boa luz. Você pode corrigir antes de buscar."}
        </p>

        {previewUrl && phase === "processing" && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Prévia da foto da placa"
              className="max-h-40 w-full object-cover"
            />
          </div>
        )}
      </div>

      {mounted && cameraOverlay ? createPortal(cameraOverlay, document.body) : null}
    </>
  );
}
