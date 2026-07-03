import {
  PRIMARY_WORKFLOW_TASKS,
  type WorkflowTaskKey,
} from "@/lib/order-workflow";

type ServiceLike = {
  id: string;
  name: string;
  defaultPrice: number;
  vehiclePrices: { vehicleType: string; price: number }[];
};

export type OrderItemInput = {
  serviceId: string | null;
  serviceName: string;
  price: number;
  employeeId: string | null;
};

function priceFor(service: ServiceLike, vehicleType: string) {
  const vp = service.vehiclePrices.find((p) => p.vehicleType === vehicleType);
  return vp?.price ?? service.defaultPrice;
}

export function buildOrderItems(params: {
  services: ServiceLike[];
  vehicleType: string;
  workflow: Record<WorkflowTaskKey, { employeeId: string | null }>;
  extras: Record<string, { selected: boolean; employeeId: string | null }>;
}): OrderItemInput[] {
  const { services, vehicleType, workflow, extras } = params;
  const items: OrderItemInput[] = [];
  const serviceById = new Map(services.map((s) => [s.id, s]));

  const selectedExtras = Object.entries(extras).filter(
    ([, state]) => state.selected && state.employeeId
  );

  for (const { key, label } of PRIMARY_WORKFLOW_TASKS) {
    const employeeId = workflow[key].employeeId;
    if (!employeeId) continue;
    items.push({
      serviceId: null,
      serviceName: label,
      price: 0,
      employeeId,
    });
  }

  for (const [serviceId, state] of selectedExtras) {
    const svc = serviceById.get(serviceId);
    if (!svc || !state.employeeId) continue;

    items.push({
      serviceId: svc.id,
      serviceName: svc.name,
      price: priceFor(svc, vehicleType),
      employeeId: state.employeeId,
    });
  }

  return items;
}

export function orderItemsSubtotal(items: OrderItemInput[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

export function primaryOrderEmployeeId(
  workflow: Record<WorkflowTaskKey, { employeeId: string | null }>,
  items: OrderItemInput[]
): string | null {
  if (workflow.lavagem.employeeId) return workflow.lavagem.employeeId;
  for (const task of Object.values(workflow)) {
    if (task.employeeId) return task.employeeId;
  }
  return items.find((i) => i.employeeId)?.employeeId ?? null;
}
