"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Camera, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { prepareImageForOcr } from "@/lib/plate-image";
import { recognizePlateFromImage } from "@/lib/plate-ocr";

type PlateScannerProps = {
  onPlateDetected: (plate: string) => void;
  disabled?: boolean;
  className?: string;
};

type ScanPhase = "idle" | "processing";

const actionClassName =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-100 text-base font-medium text-slate-900 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 touch-manipulation active:scale-[0.99] sm:h-11 sm:text-sm";

function toUserMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;
    if (
      msg.includes("JSON") ||
      msg.includes("pattern") ||
      msg.includes("Unexpected token")
    ) {
      return "Erro ao ler a placa. Tente outra foto ou digite manualmente.";
    }
    return msg;
  }
  return "Erro ao processar a foto. Tente novamente ou digite a placa.";
}

export function PlateScanner({
  onPlateDetected,
  disabled,
  className,
}: PlateScannerProps) {
  const reactId = useId().replace(/:/g, "");
  const cameraInputId = `plate-camera-${reactId}`;
  const galleryInputId = `plate-gallery-${reactId}`;

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

      const url = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      try {
        const prepared = await prepareImageForOcr(file);
        setStatusMessage("Carregando leitor… (1ª vez pode demorar)");

        const plate = await recognizePlateFromImage(prepared, (pct) => {
          if (pct < 15) {
            setStatusMessage("Carregando leitor… (1ª vez pode demorar)");
          } else {
            setStatusMessage(`Lendo placa… ${pct}%`);
          }
        });

        if (!plate) {
          setLocalError(
            "Não encontramos a placa na foto. Enquadre só a placa ou digite manualmente."
          );
          return;
        }

        setLocalError(null);
        onPlateDetected(plate);
      } catch (err) {
        setLocalError(toUserMessage(err));
      } finally {
        setPhase("idle");
        setStatusMessage(null);
      }
    },
    [disabled, onPlateDetected, phase]
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
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:hidden">
            <label htmlFor={cameraInputId} className={cn(actionClassName, "cursor-pointer")}>
              <Camera className="h-5 w-5 shrink-0" />
              Tirar foto
            </label>
            <label htmlFor={galleryInputId} className={cn(actionClassName, "cursor-pointer")}>
              <ImageIcon className="h-5 w-5 shrink-0" />
              Galeria
            </label>
          </div>

          <label
            htmlFor={galleryInputId}
            className={cn(actionClassName, "hidden cursor-pointer lg:inline-flex")}
          >
            <ImageIcon className="h-5 w-5 shrink-0" />
            Buscar foto na galeria
          </label>
        </>
      )}

      <p className="text-center text-xs text-slate-500 lg:hidden">
        Enquadre só a placa na foto, com boa luz.
      </p>
      <p className="hidden text-xs text-slate-500 lg:block">
        Selecione uma foto da placa salva no computador.
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
