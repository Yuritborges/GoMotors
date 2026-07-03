/** Envio simples de e-mail via Resend (opcional — configure RESEND_API_KEY). */
export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Go Motors <noreply@gomotors.local>";

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY não configurada" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: body || res.statusText };
  }

  return { ok: true };
}

export function stockAlertEmailTo(): string | null {
  return process.env.STOCK_ALERT_EMAIL?.trim() || null;
}
