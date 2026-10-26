import { useState, useEffect } from "react";
import { downloadDocument } from "@/lib/operations";

interface MulticaixaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  studentName?: string;
  amount?: string;
}

export function MulticaixaModal({
  isOpen,
  onClose,
  onSuccess,
  studentName = "Maria Domingos",
  amount = "45 000 Kz",
}: MulticaixaModalProps) {
  const [phone, setPhone] = useState("923 456 789");
  const [step, setStep] = useState<"input" | "waiting" | "success">("input");
  const [countdown, setCountdown] = useState(60);
  const [receiptNumber] = useState(() => `FT-TRANSIGO-2026/${Math.floor(1000 + Math.random() * 9000)}`);
  const [transactionRef] = useState(() => `MCX-${Math.floor(100000 + Math.random() * 900000)}-EMIS`);

  useEffect(() => {
    if (step === "waiting") {
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            setStep("success");
            onSuccess();
            return 0;
          }
          return c - 1;
        });
      }, 100); // Fast simulation for responsive demo
      return () => clearInterval(timer);
    }
  }, [step, onSuccess]);

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

    const receiptContent = `=====================================================
TRANSIGO ANGOLA — FACTURA / RECIBO DE TRANSPORTE
Documento Fiscal emitido ao abrigo do regime da AGT
=====================================================
Nº Factura: ${receiptNumber}
Referência Multicaixa Express: ${transactionRef}
Data de Emissão: ${today}
Forma de Pagamento: Multicaixa Express (EMIS / GPO)
Estado: LIQUIDADO / PAGO

DADOS DO CLIENTE / ENCARREGADO:
Aluno(a): ${studentName}
Escola: Escola Primária do Morro Bento
Contacto Registado: +244 ${phone}
Luanda, Angola

DETALHE DO SERVIÇO:
- Mensalidade Transporte Escolar (Ida e Volta)
  Período: Outubro 2026 · Rota A (Mutamba - Morro Bento)
  Subtotal: ${amount}
  Imposto (IVA 14% incluído ou isento): 0 Kz
-----------------------------------------------------
TOTAL PAGO: ${amount}
-----------------------------------------------------
Certificação de Software: AGT-CERT/2026/TRANSIGO
Hash Fiscal: e7a9-90b1-4f12-88ca
Obrigado por confiar no transporte seguro TransiGo!
=====================================================`;

    downloadDocument(`Recibo-TransiGo-${studentName.replace(/\s+/g, "_")}`, receiptContent);
  }

  return (
    <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-slide-paper-ink text-slide-paper p-6 shadow-2xl border border-slide-surface">
        {/* Step 1: Input MCX phone */}
        {step === "input" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-600 text-white font-black grid place-items-center text-sm shadow">
                  MCX
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Multicaixa Express</h3>
                  <p className="text-xs text-slide-dim">Pagamento Seguro Instantâneo</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-slide-surface text-slide-dim hover:text-slide-paper grid place-items-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartPayment} className="space-y-4 text-xs">
              <div className="rounded-2xl bg-slide-bg p-3.5 border border-slide-surface">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slide-dim">Aluno:</span>
                  <span className="font-bold text-slide-paper">{studentName}</span>
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slide-dim">Serviço:</span>
                  <span className="font-bold text-slide-paper">Transporte Escolar (Mês)</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slide-surface">
                  <span className="font-bold text-slide-paper">Total a pagar:</span>
                  <span className="text-lg font-black text-slide-accent font-mono">{amount}</span>
                </div>
              </div>

              <div>
                <label className="block mb-1.5 font-bold text-slide-dim">
                  Número de Telemóvel associado ao Multicaixa Express:
                </label>
                <div className="flex items-center rounded-xl bg-slide-bg border border-slide-surface px-3 py-2.5">
                  <span className="text-slide-dim font-bold mr-2 text-sm">🇦🇴 +244</span>
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
                  Irá receber uma notificação no telemóvel para autorizar com o seu PIN do Multicaixa Express.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 py-3 text-xs font-black text-white shadow-lg cursor-pointer transition"
                >
                  Confirmar Pagamento ({amount})
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

        {/* Step 2: Waiting for PIN on user phone */}
        {step === "waiting" && (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-3xl bg-orange-600/20 text-orange-500 mx-auto grid place-items-center text-3xl mb-4 animate-bounce">
              📲
            </div>
            <h3 className="text-base font-extrabold mb-1">Verifique o seu Telemóvel</h3>
            <p className="text-xs text-slide-dim max-w-xs mx-auto mb-4">
              Enviámos uma notificação para <strong>+244 {phone}</strong>. Abra o Multicaixa Express e introduza o seu PIN secreto.
            </p>

            <div className="rounded-2xl bg-slide-bg p-3 border border-slide-surface text-xs inline-block mx-auto mb-4 font-mono text-slide-accent">
              A aguardar autorização bancária...
            </div>

            <div>
              <button
                onClick={() => {
                  setStep("success");
                  onSuccess();
                }}
                className="text-xs text-slide-accent underline font-bold cursor-pointer"
              >
                (Simular confirmação imediata)
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Success & AGT Receipt */}
        {step === "success" && (
          <div className="text-center py-2">
            <div className="w-14 h-14 rounded-full bg-slide-ok text-slide-accent-ink mx-auto grid place-items-center text-2xl font-black mb-3 shadow-lg">
              ✓
            </div>
            <h3 className="text-lg font-black text-slide-paper mb-1">Pagamento Concluído!</h3>
            <p className="text-xs text-slide-ok font-bold mb-4">
              {amount} liquidado com sucesso via Multicaixa Express
            </p>

            <div className="rounded-2xl bg-slide-bg p-3.5 border border-slide-surface text-left text-xs space-y-1.5 mb-5 font-mono">
              <div className="flex justify-between">
                <span className="text-slide-dim">Ref. EMIS:</span>
                <span className="font-bold text-slide-paper">{transactionRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Nº Factura:</span>
                <span className="font-bold text-slide-paper">{receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Certificação:</span>
                <span className="text-slide-ok">AGT-CERT/2026/VALID</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleDownloadReceipt}
                className="w-full rounded-xl bg-slide-accent text-slide-accent-ink py-2.5 text-xs font-black shadow hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>📄</span>
                <span>Descarregar Factura-Recibo Fiscal (AGT)</span>
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
