import { useState } from "react";
import { downloadDocument } from "@/lib/operations";

interface ContractRequestPageProps {
  onBackToApp?: () => void;
  onSubmitContract?: (contract: {
    client: string;
    buses: number;
    students: number;
    value: string;
    contact: string;
    phone: string;
  }) => void;
}

export function ContractRequestPage({ onBackToApp, onSubmitContract }: ContractRequestPageProps) {
  const [schoolName, setSchoolName] = useState("");
  const [district, setDistrict] = useState("Talatona");
  const [buses, setBuses] = useState(3);
  const [students, setStudents] = useState(75);
  const [shift, setShift] = useState<"morning" | "afternoon" | "both">("both");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("+244 9");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Price calculations in AOA
  const pricePerBus = shift === "both" ? 350000 : 250000;
  const estimatedTotal = buses * pricePerBus;
  const pricePerStudent = Math.round(estimatedTotal / Math.max(1, students));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolName.trim()) return;

    const valueStr = `${estimatedTotal.toLocaleString("pt-AO")} Kz`;

    if (onSubmitContract) {
      onSubmitContract({
        client: schoolName.trim(),
        buses,
        students,
        value: valueStr,
        contact: contactName.trim() || "Direcção Geral",
        phone: contactPhone.trim(),
      });
    }

    setSubmitted(true);
  }

  function handleDownloadQuote() {
    const today = new Date().toLocaleDateString("pt-AO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const quoteContent = `=====================================================
PROPOSTA DE TRANSPORTE ESCOLAR INTEGRADO — TRANSIGO
TransiGo Angola Lda. · Luanda, Angola
=====================================================
Data da Proposta: ${today}
Instituição Solicitante: ${schoolName}
Município / Zona: ${district}
Responsável: ${contactName} (${contactPhone})
Email: ${contactEmail}

ESPECIFICAÇÕES DO SERVIÇO:
- Número de Autocarros Solicitados: ${buses} autocarro(s)
- Estimativa de Alunos: ${students} alunos
- Regime de Turnos: ${shift === "both" ? "Duplo (Manhã e Tarde)" : shift === "morning" ? "Manhã" : "Tarde"}
- Cobertura Tecnológica Incluída:
  * App móvel para todos os encarregados com GPS em tempo real
  * Sistema de validação de entrega por código PIN seguro
  * App dedicada para cada motorista com lista de chamada digital
  * Painel de monitorização administrativa para a secretaria da escola
  * Botão de emergência SOS ligado à Polícia e Bombeiros de Luanda

ORÇAMENTO ESTIMADO:
- Valor mensal por autocarro: ${(pricePerBus).toLocaleString("pt-AO")} Kz
-----------------------------------------------------
VALOR TOTAL MENSAL: ${estimatedTotal.toLocaleString("pt-AO")} Kz / mês
Custo médio estimado por aluno: ${pricePerStudent.toLocaleString("pt-AO")} Kz / mês
-----------------------------------------------------
Validade da Proposta: 30 dias
Contacto Comercial: comercial@transigo.ao | +244 923 000 000
=====================================================`;

    downloadDocument(`Proposta_TransiGo_${schoolName.replace(/\s+/g, "_")}`, quoteContent);
  }

  return (
    <div className="min-h-screen bg-slide-bg text-slide-ink font-sans pb-16">
      {/* Header bar */}
      <header className="border-b border-slide-surface bg-slide-paper-ink/90 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slide-accent text-slide-accent-ink grid place-items-center font-black text-xl shadow">
            T
          </div>
          <div>
            <span className="font-extrabold text-xl text-slide-paper" style={{ fontFamily: "var(--font-display)" }}>
              TransiGo Institucional
            </span>
            <span className="text-xs text-slide-dim block">Parcerias com Escolas & Colégios em Luanda</span>
          </div>
        </div>

        {onBackToApp && (
          <button
            onClick={onBackToApp}
            className="px-4 py-2 rounded-xl bg-slide-surface text-slide-paper hover:bg-slide-surface/80 text-xs font-bold transition cursor-pointer"
          >
            ← Voltar à Aplicação
          </button>
        )}
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Hero Banner */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-black uppercase tracking-widest text-slide-accent bg-slide-surface px-3.5 py-1 rounded-full">
            Contratos de Frota Escolar · Luanda 2026
          </span>
          <h1 className="text-3xl sm:text-5xl font-black mt-4 leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            Transporte Escolar Inteligente para a sua Escola
          </h1>
          <p className="text-slide-dim mt-4 text-base leading-relaxed">
            Elimine as reclamações de atrasos, dê aos pais a localização ao vivo no telemóvel e receba relatórios diários de presenças gerados automaticamente para a sua secretaria.
          </p>
        </div>

        {submitted ? (
          <div className="max-w-xl mx-auto rounded-3xl bg-slide-surface p-8 text-center border border-slide-accent/40 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-slide-ok text-slide-accent-ink mx-auto grid place-items-center text-3xl font-black mb-4">
              ✓
            </div>
            <h2 className="text-2xl font-black mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Pedido Submetido com Sucesso!
            </h2>
            <p className="text-sm text-slide-dim mb-6">
              A equipa de operações da <strong>TransiGo Angola</strong> irá analisar o corredor viário para o colégio <strong>{schoolName}</strong> e entrar em contacto com <strong>{contactName}</strong> nas próximas 24 horas.
            </p>

            <div className="rounded-2xl bg-slide-bg p-4 text-left text-xs space-y-2 mb-6 font-mono">
              <div className="flex justify-between">
                <span className="text-slide-dim">Autocarros Solicitados:</span>
                <span className="font-bold">{buses} autocarros</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Estimativa Mensal:</span>
                <span className="font-bold text-slide-accent">{estimatedTotal.toLocaleString("pt-AO")} Kz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slide-dim">Localidade:</span>
                <span className="font-bold">{district}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownloadQuote}
                className="flex-1 rounded-xl bg-slide-accent text-slide-accent-ink py-3 text-xs font-black shadow hover:opacity-90 transition cursor-pointer"
              >
                📄 Descarregar Documento da Proposta
              </button>
              {onBackToApp && (
                <button
                  onClick={onBackToApp}
                  className="rounded-xl bg-slide-bg text-slide-paper px-6 py-3 text-xs font-bold hover:bg-slide-bg/70 transition cursor-pointer"
                >
                  Voltar à App
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8 items-start">
            {/* Left Column: Form */}
            <div className="rounded-3xl bg-slide-surface p-6 sm:p-8 border border-slide-line/20 shadow-xl">
              <h2 className="text-xl font-bold mb-4" style={{ fontFamily: "var(--font-display)" }}>
                Pedir Proposta Institucional
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slide-paper mb-1">Nome da Instituição de Ensino:</label>
                  <input
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Ex: Colégio São Francisco de Assis"
                    className="w-full rounded-xl bg-slide-bg px-4 py-2.5 text-sm text-slide-paper outline-none border border-slide-line/30 focus:border-slide-accent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slide-paper mb-1">Município / Localidade:</label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full rounded-xl bg-slide-bg px-4 py-2.5 text-xs text-slide-paper outline-none border border-slide-line/30"
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
                    <label className="block font-bold text-slide-paper mb-1">Regime de Turnos:</label>
                    <select
                      value={shift}
                      onChange={(e) => setShift(e.target.value as "morning" | "afternoon" | "both")}
                      className="w-full rounded-xl bg-slide-bg px-4 py-2.5 text-xs text-slide-paper outline-none border border-slide-line/30"
                    >
                      <option value="both">Duplo (Manhã + Tarde)</option>
                      <option value="morning">Apenas Manhã</option>
                      <option value="afternoon">Apenas Tarde</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slide-paper mb-1">
                      Autocarros Necessários ({buses}):
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={12}
                      value={buses}
                      onChange={(e) => setBuses(Number(e.target.value))}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slide-dim mt-1">
                      <span>1 autocarro</span>
                      <span>12 autocarros</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slide-paper mb-1">
                      Alunos a Transportar:
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={600}
                      value={students}
                      onChange={(e) => setStudents(Number(e.target.value))}
                      className="w-full rounded-xl bg-slide-bg px-4 py-2 text-xs text-slide-paper outline-none border border-slide-line/30 font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slide-line/20">
                  <div className="font-bold text-slide-accent mb-2">Dados do Responsável / Secretaria:</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Nome do Director(a) / Gestor(a)"
                        className="w-full rounded-xl bg-slide-bg px-3 py-2 text-xs text-slide-paper outline-none border border-slide-line/30"
                      />
                    </div>
                    <div>
                      <input
                        required
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="Telefone (+244 9xx xxx xxx)"
                        className="w-full rounded-xl bg-slide-bg px-3 py-2 text-xs text-slide-paper outline-none border border-slide-line/30 font-mono"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="Email institucional da escola"
                      className="w-full rounded-xl bg-slide-bg px-3 py-2 text-xs text-slide-paper outline-none border border-slide-line/30"
                    />
                  </div>

                  <div className="mt-3">
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Informações adicionais sobre paragens prioritárias ou horários..."
                      className="w-full rounded-xl bg-slide-bg px-3 py-2 text-xs text-slide-paper outline-none border border-slide-line/30"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-slide-accent text-slide-accent-ink py-3.5 text-xs font-black shadow-lg hover:opacity-95 transition cursor-pointer"
                >
                  Enviar Pedido de Contrato Oficial
                </button>
              </form>
            </div>

            {/* Right Column: Dynamic Price Summary */}
            <div className="space-y-4">
              <div className="rounded-3xl bg-slide-paper-ink text-slide-paper p-6 border border-slide-surface shadow-xl">
                <span className="text-[10px] font-bold text-slide-accent uppercase tracking-wider">
                  SIMULADOR DE CUSTOS
                </span>
                <div className="text-3xl font-black text-slide-paper mt-1 font-mono">
                  {estimatedTotal.toLocaleString("pt-AO")} Kz
                </div>
                <div className="text-xs text-slide-dim">Valor mensal estimado (IVA incluído)</div>

                <div className="my-5 pt-4 border-t border-slide-surface space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slide-dim">Frota alocada:</span>
                    <span className="font-bold">{buses} autocarros dedicados</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slide-dim">Capacidade total:</span>
                    <span className="font-bold">{students} lugares garantidos</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slide-dim">Custo médio por aluno:</span>
                    <span className="font-mono text-slide-ok font-bold">
                      ~{pricePerStudent.toLocaleString("pt-AO")} Kz/mês
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-slide-bg p-3 text-[11px] text-slide-dim space-y-1">
                  <div>✓ Motoristas profissionais com cadastro e teste toxicológico</div>
                  <div>✓ Manutenção preventiva e autocarros de reserva imediata</div>
                  <div>✓ Licença e seguro escolar da DNVT em conformidade</div>
                </div>
              </div>

              {/* Instant proposal download */}
              <div className="rounded-2xl bg-slide-surface p-4 border border-slide-line/20 text-center">
                <div className="font-bold text-xs mb-1">Deseja uma proposta formal em PDF/TXT?</div>
                <p className="text-[11px] text-slide-dim mb-3">
                  Pode descarregar uma minuta oficial do orçamento preliminar.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadQuote}
                  className="w-full rounded-xl bg-slide-bg hover:bg-slide-bg/70 text-slide-paper py-2 text-xs font-bold border border-slide-line/30 transition cursor-pointer"
                >
                  📄 Descarregar Minuta de Orçamento
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
