export type FixedDisplayLaneKey =
  | "AGUARDANDO"
  | "LAVAGEM"
  | "ASPIRACAO"
  | "SECAGEM"
  | "PRONTO";

export type DisplayLaneEntry = {
  orderId: string;
  plate: string;
  clientName: string;
  serviceName: string;
  employeeName: string | null;
  queuePosition?: number;
};

export type DisplayColumn = {
  lane: string;
  label: string;
  fixed: boolean;
  entries: DisplayLaneEntry[];
};

export type DisplayOrderInput = {
  id: string;
  status: string;
  vehicle: { plate: string };
  client: { name: string };
  items: { serviceName: string; employee: { name: string } | null }[];
};
