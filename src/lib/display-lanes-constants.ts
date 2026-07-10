import type { FixedDisplayLaneKey } from "./display-lanes-types";

export const FIXED_DISPLAY_LANES: { key: FixedDisplayLaneKey; label: string }[] = [
  { key: "AGUARDANDO", label: "Aguardando" },
  { key: "LAVAGEM", label: "Lavagem" },
  { key: "SECAGEM", label: "Secagem" },
  { key: "ASPIRACAO", label: "Aspiração" },
  { key: "PRONTO", label: "Pronto" },
];
