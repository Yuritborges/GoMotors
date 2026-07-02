"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [stopCamera, previewUrl]);

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

  async function openCamera() {
    if (disabled) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setPhase("camera");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      fileInputRef.current?.click();
    }
  }

  function closeCamera() {
    stopCamera();
    setPhase("idle");
  }

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

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

  const busy = phase === "processing" || disabled;

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
          ) : (
            <>
              <Camera className="h-5 w-5" />
              Fotografar placa
            </>
          )}
        </Button>

        <p className="text-center text-xs text-slate-500 sm:text-left">
          Aponte para a placa com boa luz. Você pode corrigir antes de buscar.
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

      {phase === "camera" && (
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

          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
              <div className="h-16 w-full max-w-xs rounded-lg border-2 border-dashed border-white/80 bg-black/20" />
            </div>
          </div>

          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              className="h-14 w-full text-base"
              onClick={() => void captureFromCamera()}
            >
              Capturar placa
            </Button>
            <button
              type="button"
              className="mt-3 w-full text-center text-sm text-white/80 underline touch-manipulation"
              onClick={() => fileInputRef.current?.click()}
            >
              Ou escolher da galeria
            </button>
          </div>
        </div>
      )}
    </>
  );
}
