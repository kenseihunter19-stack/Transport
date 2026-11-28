import { useState, useEffect } from "react";
import { AlertCircle, Clock, Copy, FileText, Smartphone, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import {
  formatAOA,
  readMoBussSync,
  subscribeMoBussSync,
  type SyncedPricingConfig,
} from "@/lib/mobuss-sync";

interface MulticaixaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  studentId?: number;
  studentName?: string;
  guardianName?: string;
  phone?: string;
  schoolName?: string;
  routeLabel?: string;
  amountValue?: number;
}

interface CreatedInvoiceSummary {
  id: number;
  invoiceNumber: string;
  paymentEntity: string;
  paymentReferencePin: string;
  amountAoa: number;
}

export function MulticaixaModal({
  isOpen,
  onClose,
  onSuccess,
  studentId,
  studentName = "",
  phone: profilePhone = "",
  amountValue,
}: MulticaixaModalProps) {
  const { apiFetch, getAuthToken } = useAuth();
  const [pricing, setPricing] = useState<SyncedPricingConfig>(() => readMoBussSync().pricing);
  const normalizedInitialPhone = profilePhone.replace(/^\+244\s*/, "").trim();
  const [phone, setPhone] = useState(normalizedInitialPhone);
  const [step, setStep] = useState<"input" | "waiting">("input");
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoiceSummary | null>(null);

  const entityCode = createdInvoice?.paymentEntity || pricing.multicaixaEntityCode || "00845";
  const trimmedStudent = studentName.trim();

  useEffect(() => {
    setPricing(readMoBussSync().pricing);
    return subscribeMoBussSync((s) => setPricing(s.pricing));
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPhone(profilePhone.replace(/^\+244\s*/, "").trim());
      setErrorMessage(null);
    } else {
      setStep("input");
      setSubmitting(false);
      setDownloadingPdf(false);
      setErrorMessage(null);
      setCopied(false);
      setCreatedInvoice(null);
    }
  }, [isOpen, profilePhone]);

  const effectiveAmount = createdInvoice?.amountAoa ?? amountValue ?? pricing.studentMonthlyFee;
  const formattedAmount = formatAOA(effectiveAmount);

  if (!isOpen) return null;

  async function handleStartPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmedStudent) {
      setErrorMessage("Nenhum educando vinculado para gerar referência de pagamento.");
      return;
    }
    if (!phone.trim()) {
      setErrorMessage("O perfil do encarregado não possui número de telefone registado.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await apiFetch<{
        invoice: {
          id: number;
          invoiceNumber: string;
          paymentEntity: string | null;
          paymentReferencePin: string | null;
          amountAoa: number;
        };
        paymentEntity: string;
        paymentReferencePin: string;
        amountAoa: number;
      }>("/api/v1/guardian/payment-intents", {
        method: "POST",
        body: JSON.stringify({
          studentId: studentId ?? undefined,
          studentName: trimmedStudent,
        }),
      });

      setCreatedInvoice({
        id: res.invoice.id,
        invoiceNumber: res.invoice.invoiceNumber,
        paymentEntity: res.paymentEntity || res.invoice.paymentEntity || entityCode,
        paymentReferencePin: res.paymentReferencePin || res.invoice.paymentReferencePin || "",
        amountAoa: res.amountAoa ?? res.invoice.amountAoa ?? effectiveAmount,
      });
      setStep("waiting");
      onSuccess?.();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Não foi possível gerar a referência Multicaixa Express.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadProformaPdf() {
    if (!createdInvoice) return;
    setDownloadingPdf(true);
    setErrorMessage(null);
    try {
      await downloadInvoicePdf({
        invoiceId: createdInvoice.id,
        invoiceNumber: createdInvoice.invoiceNumber,
        isPaid: false,
        getAuthToken,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao descarregar o PDF da fatura.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-slide-paper-ink text-slide-paper p-5 shadow-2xl border border-slide-surface max-h-[85vh] overflow-y-auto">
        {step === "input" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-600 text-white font-black grid place-items-center text-sm shadow">
                  MCX
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Multicaixa Express</h3>
                  <p className="text-xs text-slide-dim">Pagamento por Entidade / PIN</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-slide-surface text-slide-dim hover:text-slide-paper grid place-items-center cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {!trimmedStudent ? (
              <div className="space-y-4 text-xs">
                <div className="rounded-2xl bg-red-950/50 border border-red-500/40 p-3.5 flex items-start gap-2.5 text-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <div>
                    <p className="font-bold text-red-100">Sem educando vinculado</p>
                    <p className="mt-1 text-red-200/90">
                      Não é possível gerar um pagamento porque a sua conta de encarregado ainda não tem um educando vinculado.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl bg-slide-surface px-3 py-3 text-xs font-bold text-slide-paper hover:bg-slide-surface/80 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleStartPayment} className="space-y-4 text-xs">
                <div className="rounded-2xl bg-slide-bg p-3.5 border border-slide-surface">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slide-dim">Aluno:</span>
                    <span className="font-bold text-slide-paper">{trimmedStudent}</span>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slide-dim">Entidade MôBus:</span>
                    <span className="font-mono font-bold text-orange-400">{entityCode}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slide-surface">
                    <span className="font-bold text-slide-paper">Total a pagar:</span>
                    <span className="text-lg font-black text-slide-accent font-mono tabular-nums">{formattedAmount}</span>
                  </div>
                </div>

                <div>
                  <label className="block mb-1.5 font-bold text-slide-dim">
                    Telemóvel do perfil do encarregado:
                  </label>
                  <div className="flex items-center rounded-xl bg-slide-bg border border-slide-surface px-3 py-2.5">
                    <span className="text-slide-dim font-bold mr-2 text-xs font-mono bg-white/5 px-1.5 py-0.5 rounded">AO +244</span>
                    <input
                      required
                      readOnly={Boolean(normalizedInitialPhone)}
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Introduza o seu telefone"
                      className="flex-1 bg-transparent text-sm font-mono font-bold text-slide-paper outline-none tracking-wider"
                    />
                  </div>
                  <p className="text-[10px] text-slide-dim mt-1.5">
                    Será gerado um PIN/Referência de 9 dígitos para pagar pela Entidade <strong>{entityCode}</strong> no Multicaixa Express. A fatura só é marcada como paga após conciliação administrativa.
                  </p>
                </div>

                {errorMessage && (
                  <p className="rounded-xl bg-red-950/50 border border-red-500/40 px-3 py-2 text-[11px] text-red-200">
                    {errorMessage}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-60 py-3 text-xs font-black text-white shadow-lg cursor-pointer transition tabular-nums"
                  >
                    {submitting ? "A gerar referência..." : `Gerar PIN / Referência (${formattedAmount})`}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl bg-slide-surface px-3 py-3 text-xs font-bold text-slide-dim hover:text-slide-paper cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {step === "waiting" && createdInvoice && (
          <div className="text-center py-3 space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-orange-600/20 text-orange-400 mx-auto grid place-items-center">
              <Smartphone className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-extrabold">Referência Gerada (Aguarda Pagamento)</h3>
              <p className="text-[11px] text-slide-dim mt-1">
                Documento <strong>{createdInvoice.invoiceNumber}</strong> · No Multicaixa Express escolha <strong>Pagamentos → Pagamento por Referência</strong>:
              </p>
            </div>

            <div className="rounded-2xl bg-slide-bg p-3.5 border border-orange-500/35 text-left text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slide-dim">Entidade:</span>
                <span className="font-black text-white">{createdInvoice.paymentEntity}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slide-dim">PIN / Referência:</span>
                <span className="font-black text-orange-300 tracking-wider">{createdInvoice.paymentReferencePin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Montante:</span>
                <span className="font-black text-white tabular-nums">{formattedAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Estado:</span>
                <span className="text-amber-400 font-bold inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Aguardando conciliação
                </span>
              </div>
            </div>

            <p className="text-[11px] text-amber-300/90 bg-amber-950/35 border border-amber-500/30 rounded-xl p-2.5 text-left">
              O pagamento não é confirmado automaticamente. Após efetuar a transferência no Multicaixa Express, um administrador irá conciliar a fatura e marcá-la como paga.
            </p>

            {errorMessage && (
              <p className="rounded-xl bg-red-950/50 border border-red-500/40 px-3 py-2 text-[11px] text-red-200 text-left">
                {errorMessage}
              </p>
            )}

            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(createdInvoice.paymentReferencePin.replace(/\s+/g, ""));
                    setCopied(true);
                  }}
                  className="flex-1 rounded-xl bg-slide-surface border border-white/10 py-2 text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? "PIN Copiado!" : "Copiar PIN"}</span>
                </button>
                <button
                  type="button"
                  disabled={downloadingPdf}
                  onClick={() => {
                    void handleDownloadProformaPdf();
                  }}
                  className="flex-1 rounded-xl bg-slide-accent text-slide-accent-ink py-2 text-xs font-black inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{downloadingPdf ? "A gerar PDF..." : "Fatura Proforma"}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-slide-surface text-slide-paper py-2 text-xs font-bold cursor-pointer hover:bg-slide-surface/80 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
