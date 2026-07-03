"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Camera, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { prepareImageForOcr } from "@/lib/plate-image";

type PlateScannerProps = {
  onPlateDetected: (plate: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  className?: string;
};

type ScanPhase = "idle" | "processing";

function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  );
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

  const [touchDevice, setTouchDevice] = useState(false);
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setTouchDevice(isTouchDevice());
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const processFile = useCallback(
    async (file: File) => {
      if (disabled || phase === "processing") return;

      setPhase("processing");
      setStatusMessage("Preparando foto…");
      setLocalError(null);
      onError?.("");

      const url = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      try {
        const prepared = await prepareImageForOcr(file);
        setStatusMessage("Enviando e lendo placa…");

        const formData = new FormData();
        formData.append("image", prepared, "plate.jpg");

        const res = await fetch("/api/plate-ocr", {
          method: "POST",
          body: formData,
        });

        const data = (await res.json()) as { plate?: string | null; error?: string };

        if (!res.ok) {
          throw new Error(data.error ?? "Não foi possível ler a placa.");
        }

        if (!data.plate) {
          const message =
            data.error ??
            "Não encontramos a placa na foto. Enquadre só a placa ou digite manualmente.";
          setLocalError(message);
          onError?.(message);
          return;
        }

        setStatusMessage(null);
        setLocalError(null);
        onPlateDetected(data.plate);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Erro ao processar a foto. Tente novamente ou digite a placa.";
        setLocalError(message);
        onError?.(message);
      } finally {
        setPhase("idle");
        setStatusMessage(null);
      }
    },
    [disabled, onError, onPlateDetected, phase]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const file = input.files?.[0];
      if (!file) return;

      void processFile(file).finally(() => {
        input.value = "";
      });
    },
    [processFile]
  );

  const busy = phase === "processing" || disabled;

  return (
    <div className={cn("relative space-y-2", className)}>
      <input
        id={cameraInputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        disabled={busy}
        onChange={onFileChange}
      />
      <input
        id={galleryInputId}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        disabled={busy}
        onChange={onFileChange}
      />

      {busy ? (
        <div className={cn(actionClassName, "pointer-events-none bg-sky-50 text-sky-900")}>
          <Loader2 className="h-5 w-5 animate-spin" />
          {statusMessage ?? "Lendo placa…"}
        </div>
      ) : touchDevice ? (
        <div className="grid grid-cols-2 gap-2">
          <label htmlFor={cameraInputId} className={cn(actionClassName, "cursor-pointer")}>
            <Camera className="h-5 w-5 shrink-0" />
            Tirar foto
          </label>
          <label htmlFor={galleryInputId} className={cn(actionClassName, "cursor-pointer")}>
            <ImageIcon className="h-5 w-5 shrink-0" />
            Galeria
          </label>
        </div>
      ) : (
        <label htmlFor={galleryInputId} className={cn(actionClassName, "cursor-pointer")}>
          <ImageIcon className="h-5 w-5 shrink-0" />
          Buscar foto na galeria
        </label>
      )}

      <p className="text-center text-xs text-slate-500 sm:text-left">
        {touchDevice
          ? "Enquadre só a placa na foto, com boa luz."
          : "Selecione uma foto da placa salva no computador."}
      </p>

      {previewUrl && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Prévia da foto"
            className="max-h-40 w-full object-cover"
          />
        </div>
      )}

      {localError && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
          {localError}
        </p>
      )}
    </div>
  );
}
