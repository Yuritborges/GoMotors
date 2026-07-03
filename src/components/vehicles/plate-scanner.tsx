"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ImageIcon, Loader2, Video, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { prepareImageForOcr } from "@/lib/plate-image";
import { recognizePlateFromImage } from "@/lib/plate-ocr";
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

const actionClassName =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-100 text-base font-medium text-slate-900 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 touch-manipulation active:scale-[0.99] sm:h-11 sm:text-sm";

export function PlateScanner({
  onPlateDetected,
  onError,
  disabled,
  className,
}: PlateScannerProps) {
  const reactId = useId().replace(/:/g, "");
  const cameraInputId = `plate-camera-${reactId}`;
  const galleryInputId = `plate-gallery-${reactId}`;

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mounted, setMounted] = useState(false);
  const [touchDevice, setTouchDevice] = useState(false);
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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
        setCameraError("Não foi possível exibir a câmera. Use tirar foto ou galeria.");
      });
  }, [phase, cameraStream]);

  const reportError = useCallback(
    (message: string) => {
      setStatusMessage(null);
      onError?.(message);
    },
    [onError]
  );

  const runOcr = useCallback(
    async (file: Blob) => {
      setPhase("processing");
      setProgress(2);
      setStatusMessage("Preparando foto…");
      onError?.("");

      const url = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      try {
        const prepared = await prepareImageForOcr(file);
        setStatusMessage("Lendo placa…");
        setProgress(5);

        const plate = await recognizePlateFromImage(prepared, setProgress);

        if (!plate) {
          reportError(
            "Não conseguimos ler a placa. Enquadre só a placa, use flash se estiver escuro, ou digite manualmente."
          );
          setPhase("idle");
          return;
        }

        setStatusMessage(null);
        onPlateDetected(plate);
        setPhase("idle");
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao processar a foto. Tente novamente ou digite a placa.";
        reportError(message);
        setPhase("idle");
      }
    },
    [onPlateDetected, onError, reportError]
  );

  const handleFileInput = useCallback(
    async (input: HTMLInputElement | null) => {
      const file = input?.files?.[0];
      if (!file || disabled || phase === "processing") return;

      try {
        await runOcr(file);
      } finally {
        if (input) input.value = "";
      }
    },
    [disabled, phase, runOcr]
  );

  async function openLiveCamera() {
    if (disabled || cameraStarting || phase === "processing") return;

    if (!navigator.mediaDevices?.getUserMedia) {
      reportError("Câmera ao vivo não suportada neste navegador. Use tirar foto ou galeria.");
      return;
    }

    setCameraStarting(true);
    setCameraError(null);
    onError?.("");

    try {
      const stream = await requestCameraStream();
      streamRef.current = stream;
      setCameraStream(stream);
      setPhase("camera");
    } catch {
      reportError(
        "Não foi possível abrir a câmera. Verifique a permissão do navegador ou use tirar foto / galeria."
      );
    } finally {
      setCameraStarting(false);
    }
  }

  function closeCamera() {
    stopCamera();
    setPhase("idle");
    setCameraError(null);
  }

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setCameraError("Aguarde a câmera carregar ou use galeria.");
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
        </div>

        {cameraError && (
          <p className="bg-red-950/80 px-4 py-2 text-center text-sm text-red-200">
            {cameraError}
          </p>
        )}

        <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            className="h-14 w-full text-base"
            onClick={() => void captureFromCamera()}
          >
            Capturar placa
          </Button>
          <label
            htmlFor={galleryInputId}
            className="block w-full cursor-pointer text-center text-sm text-white/80 underline touch-manipulation"
          >
            Ou escolher da galeria
          </label>
        </div>
      </div>
    ) : null;

  return (
    <>
      <input
        id={cameraInputId}
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        onChange={() => void handleFileInput(cameraInputRef.current)}
      />
      <input
        id={galleryInputId}
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        onChange={() => void handleFileInput(galleryInputRef.current)}
      />

      <div className={cn("relative space-y-2", className)}>
        {busy ? (
          <div className={cn(actionClassName, "pointer-events-none opacity-60")}>
            <Loader2 className="h-5 w-5 animate-spin" />
            {phase === "processing"
              ? statusMessage ?? `Lendo placa… ${progress > 0 ? `${progress}%` : ""}`
              : "Abrindo câmera…"}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label htmlFor={cameraInputId} className={cn(actionClassName, "cursor-pointer")}>
              <Camera className="h-5 w-5 shrink-0" />
              Tirar foto
            </label>
            <label htmlFor={galleryInputId} className={cn(actionClassName, "cursor-pointer")}>
              <ImageIcon className="h-5 w-5 shrink-0" />
              Galeria
            </label>
          </div>
        )}

        {!busy && (
          <button
            type="button"
            className={cn(actionClassName, "cursor-pointer bg-white ring-1 ring-slate-200")}
            onClick={() => void openLiveCamera()}
          >
            <Video className="h-5 w-5 shrink-0" />
            Câmera ao vivo
          </button>
        )}

        <p className="text-center text-xs text-slate-500 sm:text-left">
          {touchDevice
            ? "Use tirar foto ou galeria. Enquadre só a placa com boa luz."
            : "Escolha uma foto ou use a câmera ao vivo no computador."}
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
