"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Camera, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { prepareImageForOcr } from "@/lib/plate-image";
import {
  generatePlateLookupVariants,
  recognizePlateCandidatesFromImage,
} from "@/lib/plate-ocr";
import { PlateCameraModal } from "@/components/vehicles/plate-camera-modal";

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

async function lookupPlateInDb(
  plate: string
): Promise<{ match: string | null; suggestions: string[] }> {
  const variants = generatePlateLookupVariants(plate);
  const seen = new Set<string>();
  const suggestions = new Set<string>();

  for (const candidate of variants) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);

    const res = await fetch(`/api/vehicles/lookup?plate=${encodeURIComponent(candidate)}`);
    if (!res.ok) continue;
    const data = (await res.json()) as {
      found?: boolean;
      plate?: string;
      suggestions?: string[];
    };
    if (data.found && data.plate) return { match: data.plate, suggestions: [] };
    for (const s of data.suggestions ?? []) suggestions.add(s);
  }

  return { match: null, suggestions: [...suggestions] };
}

export function PlateScanner({
  onPlateDetected,
  disabled,
  className,
}: PlateScannerProps) {
  const reactId = useId().replace(/:/g, "");
  const galleryInputId = `plate-gallery-${reactId}`;

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pickCandidates, setPickCandidates] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const applyPlate = useCallback(
    (plate: string) => {
      setPickCandidates([]);
      setLocalError(null);
      onPlateDetected(plate);
    },
    [onPlateDetected]
  );

  const processFile = useCallback(
    async (file: File) => {
      if (disabled || phase === "processing") return;

      setPhase("processing");
      setStatusMessage("Preparando foto…");
      setLocalError(null);
      setPickCandidates([]);

      const url = URL.createObjectURL(file);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });

      try {
        const prepared = await prepareImageForOcr(file);
        setStatusMessage("Carregando leitor… (1ª vez pode demorar)");

        const candidates = await recognizePlateCandidatesFromImage(prepared, (pct) => {
          if (pct < 15) {
            setStatusMessage("Carregando leitor… (1ª vez pode demorar)");
          } else {
            setStatusMessage(`Lendo placa… ${pct}%`);
          }
        });

        if (candidates.length === 0) {
          setLocalError(
            "Não encontramos a placa na foto. Enquadre só a placa (duas linhas) ou digite manualmente."
          );
          return;
        }

        const unique = [...new Set(candidates)].slice(0, 8);
        const dbSuggestions = new Set<string>();

        for (const candidate of unique) {
          const { match, suggestions } = await lookupPlateInDb(candidate);
          if (match) {
            applyPlate(match);
            return;
          }
          for (const s of suggestions) dbSuggestions.add(s);
        }

        const pickList = [...new Set([...unique, ...dbSuggestions])].slice(0, 6);
        setPickCandidates(pickList);
        setLocalError(
          "Confira a placa abaixo e toque na correta. Evite incluir a tarja azul BRASIL na foto."
        );
      } catch (err) {
        setLocalError(toUserMessage(err));
      } finally {
        setPhase("idle");
        setStatusMessage(null);
      }
    },
    [applyPlate, disabled, phase]
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
        id={galleryInputId}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        disabled={busy}
        onChange={onFileChange}
      />

      <PlateCameraModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => void processFile(file)}
      />

      {busy ? (
        <div className={cn(actionClassName, "pointer-events-none bg-sky-50 text-sky-900")}>
          <Loader2 className="h-5 w-5 animate-spin" />
          {statusMessage ?? "Lendo placa…"}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:hidden">
            <button
              type="button"
              className={cn(actionClassName, "cursor-pointer")}
              onClick={() => setCameraOpen(true)}
            >
              <Camera className="h-5 w-5 shrink-0" />
              Tirar foto
            </button>
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
        Ao tirar foto, use a moldura na tela — só os caracteres da placa entram na leitura.
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

      {pickCandidates.length > 0 && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
          <p className="mb-2 text-sm font-medium text-sky-950">
            Qual placa aparece na foto?
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {pickCandidates.map((plate) => (
              <button
                key={plate}
                type="button"
                className="min-h-[44px] rounded-lg border border-sky-300 bg-white px-3 py-2 text-base font-bold tracking-widest text-slate-900 touch-manipulation hover:bg-sky-100"
                onClick={() => applyPlate(plate)}
              >
                {plate}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-sky-800">
            Nenhuma bate? Digite a placa manualmente no campo acima.
          </p>
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
