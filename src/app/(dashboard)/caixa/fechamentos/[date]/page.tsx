"use client";

import { Suspense, use } from "react";
import { CashClosingReportLoader } from "@/components/caixa/cash-closing-report";
import { PageHeader } from "@/components/layout/page-header";

type Props = { params: Promise<{ date: string }> };

function FechamentoInner({ date }: { date: string }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Relatório de fechamento" description={`Caixa do dia ${date}`} />
      <Suspense fallback={<p className="text-sm text-slate-500">Carregando relatório...</p>}>
        <CashClosingReportLoader date={date} />
      </Suspense>
    </div>
  );
}

export default function FechamentoCaixaPage({ params }: Props) {
  const { date } = use(params);
  return <FechamentoInner date={date} />;
}
