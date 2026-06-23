"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReceiptPrintActions({ orderId }: { orderId: string }) {
  return (
    <div className="no-print flex flex-wrap gap-2">
      <Button onClick={() => window.print()} className="gap-2">
        <Printer className="h-4 w-4" />
        Imprimir comprovante
      </Button>
      <Link href="/ordens">
        <Button variant="secondary">Voltar às ordens</Button>
      </Link>
      <Link href="/painel">
        <Button variant="outline">Painel operacional</Button>
      </Link>
    </div>
  );
}
