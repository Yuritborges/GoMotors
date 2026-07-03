import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildOrderItems,
  orderItemsSubtotal,
  primaryOrderEmployeeId,
  type OrderItemInput,
} from "@/lib/build-order-items";
import { endOfDay, startOfDay } from "@/lib/utils";
import type { WorkflowTaskKey } from "@/lib/order-workflow";
import { hasAnyAssignedService, BLOCKING_ORDER_STATUSES } from "@/lib/order-workflow";
import { paymentStatusForMethod } from "@/lib/payments";
import {
  OrderEntryDateError,
  parseOrderEntryAt,
} from "@/lib/order-entry-date";
import { handleAuthError, requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { excludeImportedOrdersWhere } from "@/lib/imported-orders";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const status = searchParams.get("status");
  const today = dateParam ? new Date(dateParam) : new Date();

  const orders = await prisma.serviceOrder.findMany({
    where: {
      entryAt: {
        gte: startOfDay(today),
        lte: endOfDay(today),
      },
      ...(status ? { status: status as never } : {}),
      ...excludeImportedOrdersWhere,
    },
    include: {
      client: true,
      vehicle: true,
      employee: true,
      items: { include: { employee: true } },
      payments: true,
    },
    orderBy: { entryAt: "desc" },
  });

  return NextResponse.json(orders);
}

type WorkflowTaskPayload = { key: WorkflowTaskKey; employeeId: string };
type ServiceItemPayload = { serviceId: string; employeeId: string };

function isWorkflowPayload(body: Record<string, unknown>) {
  return Array.isArray(body.workflowTasks) || Array.isArray(body.serviceItems);
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch (error) {
    return handleAuthError(error);
  }

  const body = await request.json();

  let entryAt: Date;
  let retroactive: boolean;
  try {
    const parsed = parseOrderEntryAt(body.entryAt);
    entryAt = parsed.entryAt;
    retroactive = parsed.retroactive;
  } catch (err) {
    const message =
      err instanceof OrderEntryDateError ? err.message : "Data/hora inválida.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: body.vehicleId },
  });

  if (!vehicle) {
    return NextResponse.json({ error: "Veículo não encontrado" }, { status: 404 });
  }

  if (!retroactive) {
    const blockingToday = await prisma.serviceOrder.findFirst({
      where: {
        vehicleId: vehicle.id,
        entryAt: { gte: startOfDay(), lte: endOfDay() },
        status: { in: [...BLOCKING_ORDER_STATUSES] },
      },
    });

    if (blockingToday) {
      return NextResponse.json(
        {
          error:
            "Este veículo já está na fila (aguardando ou em lavagem). Finalize ou avance no painel antes de abrir nova ordem.",
        },
        { status: 409 }
      );
    }
  }

  let items: OrderItemInput[] = [];
  let orderEmployeeId: string | null = body.employeeId || null;

  if (isWorkflowPayload(body)) {
    const workflowTasks = (body.workflowTasks ?? []) as WorkflowTaskPayload[];
    const serviceItems = (body.serviceItems ?? []) as ServiceItemPayload[];

    const workflow = {
      lavagem: { employeeId: null as string | null },
      aspiracao: { employeeId: null as string | null },
      secagem: { employeeId: null as string | null },
    };

    for (const task of workflowTasks) {
      if (task.key in workflow && task.employeeId) {
        workflow[task.key as WorkflowTaskKey].employeeId = task.employeeId;
      }
    }

    const extras: Record<string, { selected: boolean; employeeId: string | null }> = {};
    for (const item of serviceItems) {
      if (item.serviceId && item.employeeId) {
        extras[item.serviceId] = { selected: true, employeeId: item.employeeId };
      }
    }

    const services = await prisma.service.findMany({
      where: { active: true },
      include: { vehiclePrices: true },
    });

    items = buildOrderItems({
      services,
      vehicleType: vehicle.vehicleType,
      workflow,
      extras,
    });

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Selecione ao menos uma etapa ou serviço com funcionário." },
        { status: 400 }
      );
    }

    if (!hasAnyAssignedService(workflow, extras)) {
      return NextResponse.json(
        { error: "Selecione ao menos um serviço ou etapa com funcionário." },
        { status: 400 }
      );
    }

    orderEmployeeId = primaryOrderEmployeeId(workflow, items);
  } else {
    const services = await prisma.service.findMany({
      where: { id: { in: body.serviceIds ?? [] } },
      include: { vehiclePrices: true },
    });

    items = services.map((service) => {
      const vehiclePrice = service.vehiclePrices.find(
        (vp) => vp.vehicleType === vehicle.vehicleType
      );
      const price = vehiclePrice?.price ?? service.defaultPrice;
      return {
        serviceId: service.id,
        serviceName: service.name,
        price,
        employeeId: body.employeeId || null,
      };
    });
  }

  const subtotal = orderItemsSubtotal(items);
  const discount = Number(body.discount ?? 0);
  const total = Math.max(subtotal - discount, 0);
  const paymentMethod = body.paymentMethod ?? "PAGAR_DEPOIS";
  const paymentStatus = paymentStatusForMethod(paymentMethod);

  const auditNote = retroactive
    ? `Lançamento retroativo (${entryAt.toLocaleString("pt-BR")})`
    : null;
  const notes = [body.notes?.trim(), auditNote].filter(Boolean).join(" · ") || null;

  const order = await prisma.serviceOrder.create({
    data: {
      clientId: body.clientId,
      vehicleId: body.vehicleId,
      employeeId: orderEmployeeId,
      status: retroactive ? "ENTREGUE" : "AGUARDANDO",
      subtotal,
      discount,
      total,
      paymentMethod,
      paymentStatus,
      notes,
      entryAt,
      deliveredAt: retroactive ? entryAt : undefined,
      items: {
        create: items.map((item) => ({
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          price: item.price,
          employeeId: item.employeeId,
        })),
      },
      payments:
        paymentStatus === "PAGO"
          ? {
              create: {
                method: paymentMethod,
                amount: total,
                type: "PAGAMENTO",
                createdAt: entryAt,
              },
            }
          : undefined,
    },
    include: {
      client: true,
      vehicle: true,
      employee: true,
      items: { include: { employee: true } },
      payments: true,
    },
  });

  const vehiclePlate = vehicle.plate;
  await logAudit({
    user,
    action: retroactive ? "ORDER_RETROACTIVE" : "ORDER_CREATE",
    entityType: "order",
    entityId: order.id,
    summary: retroactive
      ? `${user.name} lançou OS retroativa ${vehiclePlate} em ${entryAt.toLocaleString("pt-BR")}`
      : `${user.name} criou OS ${vehiclePlate}`,
    metadata: {
      plate: vehiclePlate,
      total,
      paymentMethod,
      retroactive,
      entryAt: entryAt.toISOString(),
    },
  });

  return NextResponse.json(order, { status: 201 });
}
