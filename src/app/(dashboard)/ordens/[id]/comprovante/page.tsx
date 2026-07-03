import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, ORDER_STATUS_LABELS, VEHICLE_TYPE_LABELS } from "@/lib/constants";
import { ReceiptPrintActions } from "./receipt-actions";
import { ReceiptSuccessBanner } from "./receipt-success-banner";
import { Suspense } from "react";

type Params = { params: Promise<{ id: string }> };

export default async function ComprovantePage({ params }: Params) {
  const { id } = await params;

  const order = await prisma.serviceOrder.findUnique({
    where: { id },
    include: {
      client: true,
      vehicle: true,
      employee: true,
      items: { include: { service: true, employee: true } },
    },
  });

  if (!order) notFound();

  const totalMinutes = order.items.reduce(
    (sum, item) => sum + (item.service?.estimatedMinutes ?? 30),
    0
  );
  const estimatedDelivery = new Date(order.entryAt);
  estimatedDelivery.setMinutes(estimatedDelivery.getMinutes() + totalMinutes);

  const orderNumber = order.id.slice(-8).toUpperCase();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Suspense fallback={null}>
        <ReceiptSuccessBanner />
      </Suspense>
      <ReceiptPrintActions
        orderId={order.id}
        clientPhone={order.client.phone}
        clientName={order.client.name}
        plate={order.vehicle.plate}
        total={order.total}
        entryAt={order.entryAt.toISOString()}
        paymentMethod={order.paymentMethod}
        services={order.items.map((i) => i.serviceName)}
      />

      <article id="comprovante" className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <header className="border-b border-slate-200 pb-4 text-center">
          <h1 className="text-2xl font-black tracking-wide">GO MOTORS</h1>
          <p className="text-sm text-slate-500">Comprovante de recebimento — não fiscal</p>
          <p className="mt-2 text-xs text-slate-400">OS #{orderNumber}</p>
        </header>

        <section className="mt-4 space-y-3 text-sm">
          <Row label="Cliente" value={order.client.name} />
          <Row label="Telefone" value={order.client.phone} />
          <Row label="Placa" value={order.vehicle.plate} />
          <Row
            label="Veículo"
            value={`${order.vehicle.brand ?? ""} ${order.vehicle.model ?? ""} (${VEHICLE_TYPE_LABELS[order.vehicle.vehicleType]})`.trim()}
          />
          {order.vehicle.color && <Row label="Cor" value={order.vehicle.color} />}
          <Row label="Entrada" value={formatDateTime(order.entryAt)} />
          <Row label="Previsão de entrega" value={formatDateTime(estimatedDelivery)} />
          <Row label="Tempo estimado" value={`~${totalMinutes} minutos`} />
          {order.employee && <Row label="Responsável" value={order.employee.name} />}
          <Row label="Status" value={ORDER_STATUS_LABELS[order.status]} />
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Serviços
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2">
                    {item.serviceName}
                    {item.employee && (
                      <span className="block text-xs text-slate-500">
                        {item.employee.name}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">{formatCurrency(item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm">
          {order.discount > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Desconto</span>
              <span>- {formatCurrency(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Pagamento</span>
            <span>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</span>
          </div>
        </section>

        {order.notes && (
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <strong>Obs:</strong> {order.notes}
          </p>
        )}

        <footer className="mt-6 border-t border-dashed border-slate-300 pt-4 text-center text-xs text-slate-400">
          Documento sem valor fiscal. Retire seu veículo quando o status estiver &quot;Pronto&quot;.
          <br />
          Acompanhe a fila em /display na recepção.
        </footer>
      </article>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
