"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type FrameMode = "carro" | "moto";

type PlateCameraModalProps = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
};

const FRAME_CONFIG: Record<FrameMode, { aspect: number; label: string; hint: string }> = {
  carro: {
    aspect: 3.8,
    label: "Carro",
    hint: "Enquadre só os caracteres (evite a tarja azul BRASIL)",
  },
  moto: {
    aspect: 1.55,
    label: "Moto",
    hint: "Enquadre as duas linhas da placa dentro da moldura",
  },
};

async function captureFramedRegion(
  video: HTMLVideoElement,
  container: HTMLElement,
  frameEl: HTMLElement
): Promise<Blob> {
  const containerRect = container.getBoundingClientRect();
  const frameRect = frameEl.getBoundingClientRect();

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) throw new Error("Câmera ainda não está pronta. Aguarde um instante.");

  const scale = Math.max(containerRect.width / vw, containerRect.height / vh);
  const displayedW = vw * scale;
  const displayedH = vh * scale;
  const offsetX = (containerRect.width - displayedW) / 2;
  const offsetY = (containerRect.height - displayedH) / 2;

  const relLeft = frameRect.left - containerRect.left;
  const relTop = frameRect.top - containerRect.top;

  let sx = (relLeft - offsetX) / scale;
  let sy = (relTop - offsetY) / scale;
  let sw = frameRect.width / scale;
  let sh = frameRect.height / scale;

  sx = Math.max(0, Math.min(vw - 1, sx));
  sy = Math.max(0, Math.min(vh - 1, sy));
  sw = Math.max(1, Math.min(vw - sx, sw));
  sh = Math.max(1, Math.min(vh - sy, sh));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível capturar a imagem.");

  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao salvar a foto."))),
      "image/jpeg",
      0.92
    );
  });
}

export function PlateCameraModal({ open, onClose, onCapture }: PlateCameraModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [frameMode, setFrameMode] = useState<FrameMode>("carro");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [mounted, setMounted] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setReady(false);
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Câmera não disponível neste navegador.");
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
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
        setReady(true);
      }
    } catch {
      setError("Não foi possível abrir a câmera. Verifique a permissão ou use a galeria.");
    }
  }, [stopCamera]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    document.body.style.overflow = "hidden";
    void startCamera();

    return () => {
      document.body.style.overflow = "";
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  async function handleCapture() {
    const video = videoRef.current;
    const container = containerRef.current;
    const frame = frameRef.current;
    if (!video || !container || !frame || !ready) return;

    setCapturing(true);
    setError(null);

    try {
      const blob = await captureFramedRegion(video, container, frame);
      const file = new File([blob], `placa-${Date.now()}.jpg`, { type: "image/jpeg" });
      onCapture(file);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao capturar foto.");
    } finally {
      setCapturing(false);
    }
  }

  if (!mounted || !open) return null;

  const frame = FRAME_CONFIG[frameMode];

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Fotografar placa"
    >
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Escurece fora da moldura */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
        <div
          ref={frameRef}
          className="w-[min(92vw,28rem)] max-w-full rounded-xl border-[3px] border-dashed border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.58)]"
          style={{ aspectRatio: String(frame.aspect) }}
        />
      </div>

      <div className="relative z-10 flex flex-col justify-between safe-area-inset min-h-0 flex-1 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-white drop-shadow-md">Enquadre a placa</p>
            <p className="mt-1 max-w-xs text-sm text-white/90 drop-shadow">{frame.hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur touch-manipulation"
            aria-label="Fechar câmera"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mx-auto flex gap-2 rounded-full bg-black/45 p-1 backdrop-blur">
          {(Object.keys(FRAME_CONFIG) as FrameMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFrameMode(mode)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium touch-manipulation",
                frameMode === mode
                  ? "bg-white text-slate-900"
                  : "text-white/90"
              )}
            >
              {FRAME_CONFIG[mode].label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {error && (
            <p className="rounded-lg bg-red-500/90 px-3 py-2 text-center text-sm text-white">
              {error}
            </p>
          )}

          <Button
            type="button"
            className="h-14 w-full gap-2 bg-white text-base font-semibold text-slate-900 hover:bg-slate-100"
            disabled={!ready || capturing}
            onClick={() => void handleCapture()}
          >
            <Camera className="h-5 w-5" />
            {capturing ? "Capturando…" : ready ? "Capturar placa" : "Abrindo câmera…"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
