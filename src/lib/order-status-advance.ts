import { ORDER_STATUS_FLOW } from "./constants";
import {
  orderHasDynamicExtras,
  orderHasWashPipeline,
  type OrderItemLike,
} from "./order-service-lanes";

export function getNextOrderStatus(
  currentStatus: string,
  items: OrderItemLike[]
): (typeof ORDER_STATUS_FLOW)[number] | null {
  const wash = orderHasWashPipeline(items);
  const extras = orderHasDynamicExtras(items);

  switch (currentStatus) {
    case "AGUARDANDO":
      if (wash) return "EM_LAVAGEM";
      if (extras) return "FINALIZACAO";
      return "PRONTO";
    case "EM_LAVAGEM":
      if (extras) return "FINALIZACAO";
      return "PRONTO";
    case "FINALIZACAO":
      return "PRONTO";
    case "PRONTO":
      return "ENTREGUE";
    default:
      return null;
  }
}

export function isAllowedStatusTransition(
  from: string,
  to: string,
  items: OrderItemLike[]
): boolean {
  if (to === "CANCELADO") return true;
  if (to === "ENTREGUE") return from === "PRONTO";

  const wash = orderHasWashPipeline(items);
  const extras = orderHasDynamicExtras(items);
  const next = getNextOrderStatus(from, items);

  if (next === to) return true;

  if (to === "PRONTO" && from === "AGUARDANDO" && !wash && !extras) return true;
  if (to === "PRONTO" && from === "EM_LAVAGEM" && !extras) return true;
  if (to === "FINALIZACAO" && from === "AGUARDANDO" && !wash && extras) return true;

  return false;
}
