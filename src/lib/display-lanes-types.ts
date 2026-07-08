export type FixedDisplayLaneKey =
  | "AGUARDANDO"
  | "LAVAGEM"
  | "ASPIRACAO"
  | "SECAGEM"
  | "FINALIZACAO"
  | "PRONTO";

export type DisplayLaneEntry = {
  orderId: string;
  plate: string;
  clientName: string;
  serviceName: string;
  employeeName: string | null;
  queuePosition?: number;
  laneEnteredAt: string;
  estimatedMinutes: number;
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
  currentLane?: string | null;
  laneEnteredAt: Date;
  vehicle: { plate: string };
  client: { name: string };
  items: {
    serviceName: string;
    estimatedMinutes: number;
    employee: { name: string } | null;
  }[];
};
