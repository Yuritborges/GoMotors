"use client";

import Link from "next/link";
import { MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";

type ReceiptActionsProps = {
  orderId: string;
  clientPhone: string;
  clientName: string;
  plate: string;
  total: number;
  entryAt: string;
  paymentMethod: string;
  services: string[];
};

function phoneDigits(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

function buildWhatsAppUrl(props: ReceiptActionsProps) {
  const phone = phoneDigits(props.clientPhone);
  const orderRef = props.orderId.slice(-8).toUpperCase();
  const lines = [
    `Olá ${props.clientName}!`,
    "",
    "Comprovante GO MOTORS",
    `OS #${orderRef}`,
    `Placa: ${props.plate}`,
    `Entrada: ${formatDateTime(props.entryAt)}`,
    `Serviços: ${props.services.join(", ")}`,
    `Total: ${formatCurrency(props.total)}`,
    `Pagamento: ${PAYMENT_METHOD_LABELS[props.paymentMethod] ?? props.paymentMethod}`,
    "",
    "Obrigado pela preferência!",
  ];
  const text = encodeURIComponent(lines.join("\n"));
  if (phone) return `https://wa.me/${phone}?text=${text}`;
  return `https://wa.me/?text=${text}`;
}

export function ReceiptPrintActions(props: ReceiptActionsProps) {
  const whatsappUrl = buildWhatsAppUrl(props);
  const hasPhone = phoneDigits(props.clientPhone) !== null;

  return (
    <div className="no-print flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Button onClick={() => window.print()} className="w-full gap-2 sm:w-auto">
        <Printer className="h-4 w-4" />
        Imprimir comprovante
      </Button>
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
        <Button
          type="button"
          variant="secondary"
          className="w-full gap-2 border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
        >
          <MessageCircle className="h-4 w-4" />
          {hasPhone ? "Enviar no WhatsApp" : "Compartilhar no WhatsApp"}
        </Button>
      </a>
      <Link href="/ordens" className="w-full sm:w-auto">
        <Button variant="secondary" className="w-full sm:w-auto">
          Voltar às ordens
        </Button>
      </Link>
      <Link href="/painel" className="w-full sm:w-auto">
        <Button variant="outline" className="w-full sm:w-auto">
          Painel operacional
        </Button>
      </Link>
    </div>
  );
}
