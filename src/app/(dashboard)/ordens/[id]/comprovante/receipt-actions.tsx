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
  return `https://wa.me/${phone}?text=${text}`;
}

export function ReceiptPrintActions(props: ReceiptActionsProps) {
  const whatsappUrl = buildWhatsAppUrl(props);
  const hasPhone = props.clientPhone.replace(/\D/g, "").length >= 10;

  return (
    <div className="no-print flex flex-wrap gap-2">
      <Button onClick={() => window.print()} className="gap-2">
        <Printer className="h-4 w-4" />
        Imprimir comprovante
      </Button>
      {hasPhone && (
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="lg:hidden">
          <Button type="button" variant="secondary" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Enviar no WhatsApp
          </Button>
        </a>
      )}
      <Link href="/ordens">
        <Button variant="secondary">Voltar às ordens</Button>
      </Link>
      <Link href="/painel">
        <Button variant="outline">Painel operacional</Button>
      </Link>
    </div>
  );
}
