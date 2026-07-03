import type { FixedDisplayLaneKey } from "./display-lanes-types";

export const FIXED_DISPLAY_LANES: { key: FixedDisplayLaneKey; label: string }[] = [
  { key: "AGUARDANDO", label: "Aguardando" },
  { key: "LAVAGEM", label: "Lavagem" },
  { key: "ASPIRACAO", label: "Aspiração" },
  { key: "SECAGEM", label: "Secagem" },
  { key: "PRONTO", label: "Pronto" },
];
