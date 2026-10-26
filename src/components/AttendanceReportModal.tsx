import { downloadCsv, downloadDocument } from "@/lib/operations";
import type { Student } from "@/views/NativeMobileApp";

interface AttendanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  routeName?: string;
  busNumber?: number;
  driverName?: string;
  schoolName?: string;
}

export function AttendanceReportModal({
  isOpen,
  onClose,
  students,
  routeName = "Rota A · Morro Bento",
  busNumber = 12,
  driverName = "João Mateus",
  schoolName = "Escola Primária do Morro Bento",
}: AttendanceReportModalProps) {
  if (!isOpen) return null;

  const todayStr = new Date().toLocaleDateString("pt-AO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const presentCount = students.filter((s) => s.onBoard || s.droppedOff).length;
  const absentCount = students.filter((s) => s.absent).length;

  function handleExportCsv() {
    const rows = [
      ["PAUTA DE PRESENÇAS E EMBARQUE ESCOLAR — TRANSIGO ANGOLA"],
      ["Data", todayStr],
      ["Escola", schoolName],
      ["Rota", routeName],
      ["Autocarro", `Nº ${busNumber}`],
      ["Motorista", driverName],
      [],
      ["Nº", "Nome do Aluno", "Paragem", "Hora Entrada", "Hora Saída", "PIN Validado", "Estado"],
      ...students.map((s, idx) => [
        idx + 1,
        s.name,
        `Paragem ${s.stop + 1}`,
        s.onBoard || s.droppedOff ? "07:42" : "—",
        s.droppedOff ? "08:10" : "—",
        s.droppedOff ? s.pickupPin : "Pendente",
        s.absent ? `Ausente (${s.absenceReason || "Justificado"})` : s.droppedOff ? "Entregue ao Encarregado" : s.onBoard ? "A Bordo" : "Não Compareceu",
      ]),
      [],
      ["Total Presentes", presentCount],
      ["Total Ausentes", absentCount],
      ["Total Inscritos", students.length],
    ];

    downloadCsv(`Pauta_Presencas_${schoolName.replace(/\s+/g, "_")}.csv`, rows);
  }

  function handleExportDocument() {
    const content = `=====================================================
TRANSIGO ANGOLA — PAUTA DIGITAL DE TRANSPORTE ESCOLAR
Relatório Oficial de Embarque e Desembarque
=====================================================
Data da Viagem: ${todayStr}
Instituição Escolar: ${schoolName}
Rota: ${routeName} · Autocarro Nº ${busNumber}
Motorista Responsável: ${driverName}
Total de Alunos: ${students.length} (Presentes: ${presentCount} | Ausentes: ${absentCount})
=====================================================

REGISTO DE PASSAGEIROS:
${students
  .map(
    (s, idx) =>
      `${idx + 1}. ${s.name.padEnd(20)} | Paragem ${s.stop + 1} | ${
        s.absent
          ? `AUSENTE [${s.absenceReason || "Justificado"}]`
          : s.droppedOff
          ? `ENTREGUE COM SUCESSO (PIN: ${s.pickupPin})`
          : s.onBoard
          ? "A BORDO DO AUTOCARRO"
          : "PENDENTE DE EMBARQUE"
      }`
  )
  .join("\n")}

=====================================================
ASSINATURAS DE CONFORMIDADE:

_______________________________      _______________________________
Motorista de Serviço                 Secretaria da Escola / Coordenação
João Mateus                          Data: ____/____/2026
=====================================================`;

    downloadDocument(`Pauta_Oficial_${schoolName.replace(/\s+/g, "_")}`, content);
  }

  return (
    <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl bg-slide-paper-ink text-slide-paper p-6 shadow-2xl border border-slide-surface max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slide-surface">
          <div>
            <span className="text-[10px] uppercase font-bold text-slide-accent tracking-wider">
              RELATÓRIO OFICIAL DE VIAGEM
            </span>
            <h3 className="text-lg font-black text-slide-paper" style={{ fontFamily: "var(--font-display)" }}>
              Pauta Digital de Presenças
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slide-surface text-slide-dim hover:text-slide-paper grid place-items-center text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Trip Meta info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4 text-xs">
          <div className="rounded-xl bg-slide-bg p-2.5 border border-slide-surface">
            <div className="text-[10px] text-slide-dim">Escola:</div>
            <div className="font-bold truncate text-slide-paper">{schoolName}</div>
          </div>
          <div className="rounded-xl bg-slide-bg p-2.5 border border-slide-surface">
            <div className="text-[10px] text-slide-dim">Motorista:</div>
            <div className="font-bold text-slide-paper">{driverName}</div>
          </div>
          <div className="rounded-xl bg-slide-bg p-2.5 border border-slide-surface">
            <div className="text-[10px] text-slide-dim">Presentes:</div>
            <div className="font-bold text-slide-ok font-mono">{presentCount} alunos</div>
          </div>
          <div className="rounded-xl bg-slide-bg p-2.5 border border-slide-surface">
            <div className="text-[10px] text-slide-dim">Ausências:</div>
            <div className="font-bold text-amber-400 font-mono">{absentCount} alunos</div>
          </div>
        </div>

        {/* Students Roster table */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-slide-bg border border-slide-surface mb-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slide-surface text-[10px] text-slide-dim uppercase tracking-wider">
                <th className="p-3">Aluno</th>
                <th className="p-3">Paragem</th>
                <th className="p-3">PIN</th>
                <th className="p-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slide-surface">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-slide-surface/40 transition">
                  <td className="p-3 font-semibold text-slide-paper">{s.name}</td>
                  <td className="p-3 text-slide-dim">Paragem {s.stop + 1}</td>
                  <td className="p-3 font-mono font-bold text-slide-accent">{s.pickupPin}</td>
                  <td className="p-3">
                    {s.absent ? (
                      <span className="rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5 text-[10px] font-bold">
                        Ausente
                      </span>
                    ) : s.droppedOff ? (
                      <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
                        Entregue ✓
                      </span>
                    ) : s.onBoard ? (
                      <span className="rounded-full bg-slide-accent/20 text-slide-accent px-2 py-0.5 text-[10px] font-bold">
                        A bordo
                      </span>
                    ) : (
                      <span className="rounded-full bg-slide-surface text-slide-dim px-2 py-0.5 text-[10px]">
                        À espera
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slide-surface">
          <button
            onClick={handleExportCsv}
            className="flex-1 rounded-xl bg-slide-accent text-slide-accent-ink py-2.5 text-xs font-black shadow hover:opacity-95 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>📊</span>
            <span>Exportar Folha Excel (CSV)</span>
          </button>

          <button
            onClick={handleExportDocument}
            className="flex-1 rounded-xl bg-slide-surface text-slide-paper py-2.5 text-xs font-bold hover:bg-slide-surface/80 transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>📄</span>
            <span>Relatório Oficial Assinado</span>
          </button>
        </div>
      </div>
    </div>
  );
}
