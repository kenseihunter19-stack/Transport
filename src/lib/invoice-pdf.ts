import { apiUrl } from "@/lib/runtime-config";

export async function downloadInvoicePdf(params: {
  invoiceId: number;
  invoiceNumber?: string;
  isPaid?: boolean;
  getAuthToken: () => Promise<string | null>;
}): Promise<void> {
  const { invoiceId, invoiceNumber, isPaid, getAuthToken } = params;
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Sessão expirada. Inicie sessão novamente para descarregar o PDF.");
  }

  const res = await fetch(apiUrl(`/api/v1/invoices/${invoiceId}/pdf`), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    let message = `Não foi possível descarregar o PDF (HTTP ${res.status}).`;
    try {
      const errBody = await res.json();
      if (errBody?.error) message = String(errBody.error);
    } catch {
      // ignore non-JSON error body
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const safeInvoice = (invoiceNumber || String(invoiceId)).replace(/[^a-zA-Z0-9._-]+/g, "_");
  const prefix = isPaid ? "Recibo_MoBus" : "Fatura_Proforma_MoBus";
  const filename = `${prefix}_${safeInvoice}.pdf`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
