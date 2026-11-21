import { useState, useEffect, useRef } from "react";
import { Check, Copy, FileText, Smartphone, X } from "lucide-react";
import {
  exportAgtReceipt,
  formatAOA,
  readMoBussSync,
  recordSyncedPayment,
  subscribeMoBussSync,
  type SyncedPricingConfig,
} from "@/lib/mobuss-sync";

interface MulticaixaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  studentName?: string;
  guardianName?: string;
  schoolName?: string;
  routeLabel?: string;
  amountValue?: number;
}

function generateEntityReferencePin(): string {
  const a = Math.floor(100 + Math.random() * 900);
  const b = Math.floor(100 + Math.random() * 900);
  const c = Math.floor(100 + Math.random() * 900);
  return `${a} ${b} ${c}`;
}

export function MulticaixaModal({
  isOpen,
  onClose,
  onSuccess,
  studentName = "Maria Domingos",
  guardianName = "Sra. Luísa Domingos",
  schoolName = "Escola Primária do Morro Bento",
  routeLabel = "Rota A · Mutamba - Morro Bento",
  amountValue,
}: MulticaixaModalProps) {
  const [pricing, setPricing] = useState<SyncedPricingConfig>(() => readMoBussSync().pricing);
  const [phone, setPhone] = useState("923 456 789");
  const [step, setStep] = useState<"input" | "waiting" | "success">("input");
  const [copied, setCopied] = useState(false);
  const [receiptNumber] = useState(() => `FT-MOBUSS-2026/${Math.floor(1000 + Math.random() * 9000)}`);
  const [referencePin, setReferencePin] = useState(() => generateEntityReferencePin());
  const recordedRef = useRef(false);

  const entityCode = pricing.multicaixaEntityCode || "00845";
  const transactionRef = `ENT-${entityCode}-PIN-${referencePin.replace(/\s+/g, "")}`;

  useEffect(() => {
    setPricing(readMoBussSync().pricing);
    return subscribeMoBussSync((s) => setPricing(s.pricing));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setStep("input");
      setCopied(false);
      setReferencePin(generateEntityReferencePin());
      recordedRef.current = false;
    }
  }, [isOpen]);

  const effectiveAmount = amountValue ?? pricing.studentMonthlyFee;
  const formattedAmount = formatAOA(effectiveAmount);

  function completePayment() {
    if (!recordedRef.current) {
      recordedRef.current = true;
      const now = new Date();
      recordSyncedPayment({
        invoice: receiptNumber,
        student: studentName,
        guardian: guardianName,
        phone: `+244 ${phone.trim()}`,
        amount: formattedAmount,
        amountValue: effectiveAmount,
        date: now.toLocaleDateString("pt-AO", { day: "2-digit", month: "short", year: "numeric" }),
        time: now.toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" }),
        status: "Validado",
        emisRef: transactionRef,
        agtCert: `${pricing.agtCertCode}-VALID`,
      });
    }
    setStep("success");
    onSuccess();
  }

  if (!isOpen) return null;

  function handleStartPayment(e: React.FormEvent) {
    e.preventDefault();
    setStep("waiting");
  }

  function handleDownloadReceipt() {
    const today = new Date().toLocaleDateString("pt-AO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    exportAgtReceipt(
      {
        invoice: receiptNumber,
        student: studentName,
        guardian: guardianName,
        phone: `+244 ${phone}`,
        amountValue: effectiveAmount,
        date: today,
        emisRef: transactionRef,
        agtCert: `${pricing.agtCertCode}-VALID`,
        status: "Validado",
        school: schoolName,
        routeLabel,
      },
      pricing
    );
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

            <form onSubmit={handleStartPayment} className="space-y-4 text-xs">
              <div className="rounded-2xl bg-slide-bg p-3.5 border border-slide-surface">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slide-dim">Aluno:</span>
                  <span className="font-bold text-slide-paper">{studentName}</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slide-dim">Entidade MôBuss:</span>
                  <span className="font-mono font-bold text-orange-400">{entityCode}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slide-surface">
                  <span className="font-bold text-slide-paper">Total a pagar:</span>
                  <span className="text-lg font-black text-slide-accent font-mono tabular-nums">{formattedAmount}</span>
                </div>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slide-dim">
                  Telemóvel para comprovativo / contacto:
                </label>
                <div className="flex items-center rounded-xl bg-slide-bg border border-slide-surface px-3 py-2.5">
                  <span className="text-slide-dim font-bold mr-2 text-xs font-mono bg-white/5 px-1.5 py-0.5 rounded">AO +244</span>
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="9xx xxx xxx"
                    className="flex-1 bg-transparent text-sm font-mono font-bold text-slide-paper outline-none tracking-wider"
                  />
                </div>
                <p className="text-[10px] text-slide-dim mt-1.5">
                  Será gerado um PIN/Referência de 9 dígitos para pagar pela Entidade <strong>{entityCode}</strong> no Multicaixa Express.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 py-3 text-xs font-black text-white shadow-lg cursor-pointer transition tabular-nums"
                >
                  Gerar PIN / Referência ({formattedAmount})
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
          </div>
        )}

        {step === "waiting" && (
          <div className="text-center py-3 space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-orange-600/20 text-orange-400 mx-auto grid place-items-center">
              <Smartphone className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-extrabold">PIN Gerado para Multicaixa Express</h3>
              <p className="text-[11px] text-slide-dim mt-1">
                No Multicaixa Express escolha <strong>Pagamentos → Pagamento por Referência</strong>:
              </p>
            </div>

            <div className="rounded-2xl bg-slide-bg p-3.5 border border-orange-500/35 text-left text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slide-dim">Entidade:</span>
                <span className="font-black text-white">{entityCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slide-dim">PIN / Referência:</span>
                <span className="font-black text-orange-300 tracking-wider">{referencePin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Montante:</span>
                <span className="font-black text-white tabular-nums">{formattedAmount}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(referencePin.replace(/\s+/g, ""));
                  setCopied(true);
                }}
                className="flex-1 rounded-xl bg-slide-surface border border-white/10 py-2 text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied ? "PIN Copiado!" : "Copiar PIN"}</span>
              </button>
              <button
                type="button"
                onClick={completePayment}
                className="flex-1 rounded-xl bg-slide-ok py-2 text-xs font-bold text-white cursor-pointer"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="text-center py-2">
            <div className="w-14 h-14 rounded-full bg-slide-ok text-slide-accent-ink mx-auto grid place-items-center mb-3 shadow-lg">
              <Check className="w-7 h-7 stroke-[3]" />
            </div>
            <h3 className="text-lg font-black text-slide-paper mb-1">Pagamento Concluído!</h3>
            <p className="text-xs text-slide-ok font-bold mb-4 tabular-nums">
              {formattedAmount} liquidado via Entidade {entityCode}
            </p>

            <div className="rounded-2xl bg-slide-bg p-3.5 border border-slide-surface text-left text-xs space-y-1.5 mb-5 font-mono">
              <div className="flex justify-between">
                <span className="text-slide-dim">Entidade / PIN:</span>
                <span className="font-bold text-orange-300">{entityCode} · {referencePin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">NIF Emitente:</span>
                <span className="font-bold text-slide-paper tabular-nums">{pricing.companyNif}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Nº Factura:</span>
                <span className="font-bold text-slide-paper">{receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Estado Fiscal:</span>
                <span className="text-amber-400 font-semibold">Homologação (Provisório)</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleDownloadReceipt}
                className="w-full rounded-xl bg-slide-accent text-slide-accent-ink py-2.5 text-xs font-black shadow hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>Descarregar Nota Provisória (MCX)</span>
              </button>

              <button
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
