export const ORDER_STATUS_LABELS: Record<string, string> = {
  AGUARDANDO: "Aguardando",
  EM_LAVAGEM: "Em lavagem",
  FINALIZACAO: "Finalização",
  PRONTO: "Pronto",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
};

export const ORDER_STATUS_FLOW = [
  "AGUARDANDO",
  "EM_LAVAGEM",
  "FINALIZACAO",
  "PRONTO",
  "ENTREGUE",
] as const;

export const ORDER_STATUS_COLORS: Record<string, string> = {
  AGUARDANDO: "bg-amber-100 text-amber-800 border-amber-200",
  EM_LAVAGEM: "bg-blue-100 text-blue-800 border-blue-200",
  FINALIZACAO: "bg-purple-100 text-purple-800 border-purple-200",
  PRONTO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ENTREGUE: "bg-slate-100 text-slate-600 border-slate-200",
  CANCELADO: "bg-red-100 text-red-800 border-red-200",
};

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  MOTO: "Moto",
  CARRO: "Carro",
  SUV: "SUV",
  CAMINHONETE: "Caminhonete",
  OUTRO: "Outro",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  DINHEIRO: "Dinheiro",
  PIX: "Pix",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  PENDENTE: "Pendente",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAGO: "Pago",
  PENDENTE: "Pendente",
  ESTORNADO: "Estornado",
};

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  PRODUTOS_LIMPEZA: "Produtos de limpeza",
  AGUA: "Água",
  ENERGIA: "Energia",
  FUNCIONARIOS: "Funcionários",
  MANUTENCAO: "Manutenção",
  ALUGUEL: "Aluguel",
  COMPRAS_DIVERSAS: "Compras diversas",
  OUTRO: "Outro",
};
