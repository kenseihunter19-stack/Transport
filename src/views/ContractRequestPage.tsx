import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { downloadDocument } from "@/lib/operations";
import { apiUrl } from "@/lib/runtime-config";
import { readMoBussSync, subscribeMoBussSync } from "@/lib/mobuss-sync";

interface ContractRequestPageProps {
  onBackToApp?: () => void;
  onOpenAdminContracts?: () => void;
  onSubmitContract?: (contract: {
    client: string;
    location: string;
    buses: number;
    students: number;
    value: string;
    contact: string;
    phone: string;
  }) => void;
}

export function ContractRequestPage({
  onBackToApp,
  onOpenAdminContracts,
  onSubmitContract,
}: ContractRequestPageProps) {
  const [schoolName, setSchoolName] = useState("");
  const [district, setDistrict] = useState("Talatona");
  const [buses, setBuses] = useState(3);
  const [driversCount, setDriversCount] = useState(3);
  const [students, setStudents] = useState(75);
  const [shift, setShift] = useState<"morning" | "afternoon" | "both">("both");
  const [payerPreference, setPayerPreference] = useState<"school" | "parent" | "mixed" | "configurable">("configurable");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("+244 9");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pricing, setPricing] = useState(() => readMoBussSync().pricing);

  useEffect(() => {
    setPricing(readMoBussSync().pricing);
    const unsubscribe = subscribeMoBussSync((s) => setPricing(s.pricing));
    fetch(apiUrl("/api/v1/pricing/public"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.pricing) {
          setPricing((prev) => ({
            ...prev,
            studentMonthlyFee: data.pricing.studentMonthlyFeeAoa ?? prev.studentMonthlyFee,
            driverMonthlyFee: data.pricing.driverMonthlyFeeAoa ?? prev.driverMonthlyFee,
            schoolBusSingleShift: data.pricing.schoolBusSingleShiftAoa ?? prev.schoolBusSingleShift,
            schoolBusDoubleShift: data.pricing.schoolBusDoubleShiftAoa ?? prev.schoolBusDoubleShift,
            ivaPercent: data.pricing.ivaPercent ?? prev.ivaPercent,
            companyName: data.pricing.companyName ?? prev.companyName,
            companyNif: data.pricing.companyNif ?? prev.companyNif,
          }));
        }
      })
      .catch(() => null);
    return unsubscribe;
  }, []);

  const safeStudents = Math.max(1, students);
  const safeDrivers = Math.max(1, driversCount);
  const studentUnitFee = pricing.studentMonthlyFee;
  const driverUnitFee = pricing.driverMonthlyFee;
  const studentsSubtotal = safeStudents * studentUnitFee;
  const driversSubtotal = safeDrivers * driverUnitFee;
  const estimatedTotal = studentsSubtotal + driversSubtotal;
  const pricePerStudent = Math.round(estimatedTotal / safeStudents);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolName.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    const valueStr = `${estimatedTotal.toLocaleString("pt-AO")} Kz`;

    try {
      const res = await fetch(apiUrl("/api/v1/school-contract-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          municipality: district,
          shiftRegime: shift,
          busesRequested: buses,
          driversRequested: safeDrivers,
          studentsEstimate: safeStudents,
          payerPreference,
          contactName: contactName.trim() || "Direcção Geral",
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Não foi possível submeter o pedido.");
      }
      setReferenceCode(payload.referenceCode ?? null);

      if (onSubmitContract) {
        onSubmitContract({
          client: schoolName.trim(),
          location: `${district}, Luanda`,
          buses,
          students: safeStudents,
          value: valueStr,
          contact: contactName.trim() || "Direcção Geral",
          phone: contactPhone.trim(),
        });
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao comunicar com o servidor.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDownloadQuote() {
    const today = new Date().toLocaleDateString("pt-AO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const quoteContent = `=====================================================
ESTIMATIVA INDICATIVA DE TRANSPORTE ESCOLAR — MÔBUS
MôBus Angola Lda. · Luanda, Angola
=====================================================
Referência do Pedido: ${referenceCode || "MINUTA"}
Data de Emissão: ${today}
Instituição Solicitante: ${schoolName}
Município / Zona: ${district}
Modelo de Pagamento Preferencial: ${payerPreference}
Responsável: ${contactName} (${contactPhone})
Email: ${contactEmail}

ESPECIFICAÇÕES SOLICITADAS:
- Número de Autocarros Solicitados: ${buses} autocarro(s)
- Motoristas Alocados: ${safeDrivers} motorista(s)
- Estimativa de Alunos: ${safeStudents} alunos
- Regime de Turnos: ${shift === "both" ? "Duplo (Manhã e Tarde)" : shift === "morning" ? "Manhã" : "Tarde"}
- Política de Segurança: PIN de validação no embarque e no desembarque

ESTIMATIVA INDICATIVA (NÃO VINCULATIVA):
- Tarifa por aluno (${safeStudents} × ${studentUnitFee.toLocaleString("pt-AO")} Kz): ${studentsSubtotal.toLocaleString("pt-AO")} Kz
- Tarifa por motorista (${safeDrivers} × ${driverUnitFee.toLocaleString("pt-AO")} Kz): ${driversSubtotal.toLocaleString("pt-AO")} Kz
-----------------------------------------------------
ESTIMATIVA MENSAL INDICATIVA: ${estimatedTotal.toLocaleString("pt-AO")} Kz / mês
Custo médio efetivo por aluno: ${pricePerStudent.toLocaleString("pt-AO")} Kz / mês
-----------------------------------------------------
Nota: Os valores acima constituem estimativa indicativa sujeita a análise operacional e aprovação contratual da MôBus Angola.
Contacto Comercial: comercial@mobuss.ao | +244 923 000 000
=====================================================`;

    downloadDocument(`Estimativa_MoBus_${schoolName.replace(/\s+/g, "_")}`, quoteContent);
  }

  return (
    <div className="min-h-screen bg-slide-bg text-slide-ink font-sans pb-16">
      {/* Sub-header context bar */}
      <div className="border-b border-white/10 bg-slide-paper-ink/90 backdrop-blur px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slide-dim">
          <span className="font-bold text-slide-paper">MôBus Institucional</span>
          <span aria-hidden="true">·</span>
          <span>Parcerias com Escolas & Colégios em Luanda</span>
        </div>

        {onBackToApp && (
          <button
            onClick={onBackToApp}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slide-surface text-slide-paper hover:bg-white/10 text-xs font-semibold border border-white/10 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar</span>
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="text-xs font-bold tracking-wider uppercase text-slide-accent">
            Contratos de Frota Escolar · Luanda 2026
          </div>
          <h1
            className="text-3xl sm:text-5xl font-black mt-3 leading-tight text-balance"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Transporte Escolar Inteligente para a sua Escola
          </h1>
          <p className="text-slide-dim mt-4 text-sm sm:text-base leading-relaxed">
            Elimine atrasos sem aviso, ofereça localização ao vivo no telemóvel dos encarregados e receba pautas diárias de presenças geradas automaticamente para a secretaria.
          </p>
        </div>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="max-w-xl mx-auto rounded-2xl bg-slide-surface p-8 text-center border border-white/10 shadow-xl"
          >
            <div className="w-14 h-14 rounded-2xl bg-slide-ok text-white mx-auto grid place-items-center mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Pedido Submetido com Sucesso
            </h2>
            {referenceCode && (
              <div className="inline-block rounded-lg bg-slide-bg border border-white/10 px-3 py-1 text-xs font-mono font-bold text-slide-accent mb-3">
                Referência: {referenceCode}
              </div>
            )}
            <p className="text-sm text-slide-dim mb-6 leading-relaxed">
              A equipa comercial da <strong className="text-slide-paper">MôBus Angola</strong> registou o pedido de <strong className="text-slide-paper">{schoolName}</strong> na base de dados e irá analisá-lo na aba <strong className="text-slide-paper">Contratos</strong>.
            </p>

            <div className="rounded-xl bg-slide-bg p-4 text-left text-xs space-y-2 mb-6 font-mono tabular-nums border border-white/10">
              <div className="flex justify-between">
                <span className="text-slide-dim">Autocarros / Motoristas:</span>
                <span className="font-bold">{buses} autocarros · {safeDrivers} motoristas</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Alunos Cobertos:</span>
                <span className="font-bold">{safeStudents} alunos</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Estimativa Indicativa:</span>
                <span className="font-bold text-slide-accent">{estimatedTotal.toLocaleString("pt-AO")} Kz/mês</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Localidade:</span>
                <span className="font-bold">{district}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownloadQuote}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slide-accent text-slide-accent-ink py-3 px-4 text-xs font-bold shadow hover:opacity-90 active:scale-[0.98] transition cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Descarregar Minuta</span>
              </button>
              {onOpenAdminContracts && (
                <button
                  onClick={onOpenAdminContracts}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slide-ok text-white px-5 py-3 text-xs font-bold hover:opacity-90 active:scale-[0.98] transition cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Ver no Painel Admin</span>
                </button>
              )}
              {onBackToApp && (
                <button
                  onClick={onBackToApp}
                  className="rounded-xl bg-slide-bg text-slide-paper px-5 py-3 text-xs font-semibold border border-white/10 hover:bg-white/5 transition cursor-pointer"
                >
                  Voltar
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6 items-start">
            {/* Left Column: Form */}
            <div className="rounded-2xl bg-slide-surface p-6 sm:p-8 border border-white/10">
              <h2 className="text-lg font-bold mb-5" style={{ fontFamily: "var(--font-display)" }}>
                Pedir Proposta Institucional
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slide-paper mb-1.5">
                    Nome da Instituição de Ensino
                  </label>
                  <input
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Ex: Colégio São Francisco de Assis"
                    className="w-full rounded-xl bg-slide-bg px-4 py-2.5 text-sm text-slide-paper outline-none border border-white/15 focus:border-slide-accent transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slide-paper mb-1.5">
                      Município / Localidade
                    </label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full rounded-xl bg-slide-bg px-4 py-2.5 text-xs text-slide-paper outline-none border border-white/15 focus:border-slide-accent"
                    >
                      <option value="Talatona">Talatona</option>
                      <option value="Maianga">Maianga</option>
                      <option value="Ingombota / Luanda Centro">Ingombota / Luanda Centro</option>
                      <option value="Kilamba">Centralidade do Kilamba</option>
                      <option value="Belas / Morro Bento">Belas / Morro Bento</option>
                      <option value="Viana">Viana</option>
                      <option value="Cacuaco">Cacuaco</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slide-paper mb-1.5">
                      Regime de Turnos
                    </label>
                    <select
                      value={shift}
                      onChange={(e) => setShift(e.target.value as "morning" | "afternoon" | "both")}
                      className="w-full rounded-xl bg-slide-bg px-4 py-2.5 text-xs text-slide-paper outline-none border border-white/15 focus:border-slide-accent"
                    >
                      <option value="both">Duplo (Manhã + Tarde)</option>
                      <option value="morning">Apenas Manhã</option>
                      <option value="afternoon">Apenas Tarde</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold text-slide-paper mb-1.5 tabular-nums">
                      Autocarros ({buses})
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={buses}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        setBuses(next);
                        setDriversCount(next);
                      }}
                      className="w-full accent-[#e11d2e] cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-slide-dim mt-1 tabular-nums">
                      <span>1</span>
                      <span>12 autocarros</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slide-paper mb-1.5">
                      Motoristas Alocados
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={driversCount}
                      onChange={(e) => setDriversCount(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full rounded-xl bg-slide-bg px-4 py-2 text-xs text-slide-paper outline-none border border-white/15 focus:border-slide-accent font-mono tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slide-paper mb-1.5">
                      Alunos a Transportar
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={students}
                      onChange={(e) => setStudents(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full rounded-xl bg-slide-bg px-4 py-2 text-xs text-slide-paper outline-none border border-white/15 focus:border-slide-accent font-mono tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slide-paper mb-1.5">
                    Modelo de Pagamento Preferencial
                  </label>
                  <select
                    value={payerPreference}
                    onChange={(e) =>
                      setPayerPreference(e.target.value as "school" | "parent" | "mixed" | "configurable")
                    }
                    className="w-full rounded-xl bg-slide-bg px-4 py-2.5 text-xs text-slide-paper outline-none border border-white/15 focus:border-slide-accent"
                  >
                    <option value="configurable">A configurar em contrato com a MôBus</option>
                    <option value="school">Escola paga a fatura mensal consolidada</option>
                    <option value="parent">Encarregados pagam mensalidade individual</option>
                    <option value="mixed">Modelo Misto (Escola + Encarregados)</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <div className="font-bold text-slide-paper mb-2.5">
                    Dados do Responsável / Secretaria
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Nome do Director(a) / Gestor(a)"
                      className="w-full rounded-xl bg-slide-bg px-3.5 py-2.5 text-xs text-slide-paper outline-none border border-white/15 focus:border-slide-accent"
                    />
                    <input
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="Telefone (+244 9xx xxx xxx)"
                      className="w-full rounded-xl bg-slide-bg px-3.5 py-2.5 text-xs text-slide-paper outline-none border border-white/15 focus:border-slide-accent font-mono tabular-nums"
                    />
                  </div>

                  <div className="mt-3">
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="Email institucional da escola"
                      className="w-full rounded-xl bg-slide-bg px-3.5 py-2.5 text-xs text-slide-paper outline-none border border-white/15 focus:border-slide-accent"
                    />
                  </div>

                  <div className="mt-3">
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Informações adicionais sobre paragens prioritárias ou horários..."
                      className="w-full rounded-xl bg-slide-bg px-3.5 py-2.5 text-xs text-slide-paper outline-none border border-white/15 focus:border-slide-accent"
                    />
                  </div>
                </div>

                {submitError && (
                  <div className="rounded-xl bg-slide-accent/15 border border-slide-accent/40 p-3 text-xs text-red-200 font-semibold">
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-slide-accent text-slide-accent-ink py-3 text-xs font-bold shadow hover:opacity-95 active:scale-[0.99] transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "A registar pedido no servidor..." : "Enviar Pedido de Contrato Oficial"}
                </button>
              </form>
            </div>

            {/* Right Column: Dynamic Price Summary */}
            <div className="space-y-4">
              <div className="rounded-2xl bg-slide-paper-ink text-slide-paper p-6 border border-white/10">
                <span className="text-[11px] font-bold text-slide-accent uppercase tracking-wider">
                  Estimativa indicativa (não vinculativa)
                </span>
                <div className="text-3xl font-black text-slide-paper mt-1 font-mono tabular-nums">
                  {estimatedTotal.toLocaleString("pt-AO")} Kz
                </div>
                <div className="text-xs text-slide-dim">
                  Valor mensal indicativo (IVA {pricing.ivaPercent}% aplicável · sujeito a proposta formal)
                </div>

                <div className="my-5 pt-4 border-t border-white/10 space-y-2.5 text-xs tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slide-dim">
                      Alunos ({safeStudents} × {studentUnitFee.toLocaleString("pt-AO")} Kz)
                    </span>
                    <span className="font-bold font-mono">{studentsSubtotal.toLocaleString("pt-AO")} Kz</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slide-dim">
                      Motoristas ({safeDrivers} × {driverUnitFee.toLocaleString("pt-AO")} Kz)
                    </span>
                    <span className="font-bold font-mono">{driversSubtotal.toLocaleString("pt-AO")} Kz</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-slide-dim">Frota alocada</span>
                    <span className="font-bold">{buses} autocarros · {safeDrivers} motoristas</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slide-dim">Custo médio efetivo por aluno</span>
                    <span className="font-mono text-slide-ok font-bold">
                      ~{pricePerStudent.toLocaleString("pt-AO")} Kz/mês
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-slide-surface p-3.5 text-[11px] text-slide-dim space-y-2 border border-white/10">
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-slide-ok shrink-0 mt-0.5" />
                    <span>Motoristas profissionais com cadastro e teste toxicológico</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-slide-ok shrink-0 mt-0.5" />
                    <span>Manutenção preventiva e autocarros de reserva imediata</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-slide-ok shrink-0 mt-0.5" />
                    <span>Licença e seguro escolar da DNVT em conformidade</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slide-surface p-5 border border-white/10 text-center">
                <div className="font-bold text-xs mb-1">Deseja uma proposta formal em TXT?</div>
                <p className="text-[11px] text-slide-dim mb-3">
                  Descarregue uma minuta oficial do orçamento preliminar para a direção.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadQuote}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slide-bg hover:bg-white/5 text-slide-paper py-2.5 text-xs font-semibold border border-white/15 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descarregar Minuta de Orçamento</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
