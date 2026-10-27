import { useState } from "react";

export interface VehicleDoc {
  id: string;
  name: string;
  issuer: string;
  docNumber: string;
  expiryDate: string;
  daysRemaining: number;
  status: "valid" | "warning" | "expired";
}

interface VehicleDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  busId?: number;
  busPlate?: string;
}

const INITIAL_DOCS: VehicleDoc[] = [
  {
    id: "doc-1",
    name: "Seguro Automóvel Obrigatório de Passageiros",
    issuer: "ENSA Seguros Angola",
    docNumber: "POL-ENSA-2026/8942",
    expiryDate: "15 Dez 2026",
    daysRemaining: 50,
    status: "valid",
  },
  {
    id: "doc-2",
    name: "Inspeção Técnica Periódica Obrigatória",
    issuer: "DNVT / Centro de Inspeção do Palanca",
    docNumber: "INSP-LD-2461-2026",
    expiryDate: "10 Nov 2026",
    daysRemaining: 15,
    status: "warning",
  },
  {
    id: "doc-3",
    name: "Imposto sobre Veículos Motorizados (IVM / AGT)",
    issuer: "Administração Geral Tributária (AGT)",
    docNumber: "AGT-IVM-2026-LD2461",
    expiryDate: "31 Mar 2027",
    daysRemaining: 156,
    status: "valid",
  },
  {
    id: "doc-4",
    name: "Alvará & Licença de Transporte Escolar",
    issuer: "Governo Provincial de Luanda (GPL)",
    docNumber: "ALV-TRANSP-GPL-4182",
    expiryDate: "05 Nov 2026",
    daysRemaining: 10,
    status: "warning",
  },
];

export function VehicleDocumentsModal({
  isOpen,
  onClose,
  busId = 12,
  busPlate = "LD-24-61-AB",
}: VehicleDocumentsModalProps) {
  const [docs, setDocs] = useState<VehicleDoc[]>(INITIAL_DOCS);
  const [toast, setToast] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleRenew(docId: string) {
    setDocs((prev) =>
      prev.map((d) =>
        d.id === docId
          ? {
              ...d,
              expiryDate: "Novembro 2027",
              daysRemaining: 365,
              status: "valid",
            }
          : d
      )
    );
    setToast("Documento submetido para renovação com sucesso!");
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="w-full max-w-sm rounded-3xl bg-slide-paper-ink text-slide-paper p-5 shadow-2xl border border-slide-surface max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slide-surface">
          <div>
            <span className="text-[10px] uppercase font-bold text-slide-accent tracking-wider">
              CONFORMIDADE LEGAL & DNVT
            </span>
            <h3 className="text-lg font-black text-slide-paper" style={{ fontFamily: "var(--font-display)" }}>
              Documentos · Autocarro {busId}
            </h3>
            <span className="text-xs text-slide-dim font-mono">{busPlate}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slide-surface text-slide-dim hover:text-slide-paper grid place-items-center text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {toast && (
          <div className="mt-3 rounded-xl bg-slide-ok text-slide-accent-ink px-3 py-2 text-xs font-bold text-center animate-in fade-in">
            {toast}
          </div>
        )}

        {/* Warning banner */}
        <div className="mt-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 p-3 text-xs flex items-center gap-2.5 text-amber-200">
          <span className="text-base">⚠️</span>
          <span>
            Existem <strong>2 documentos a expirar</strong> em menos de 30 dias. Renove para evitar multas policiais em Luanda.
          </span>
        </div>

        {/* Documents List */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 my-4 pr-1">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className={`rounded-2xl p-3.5 border transition ${
                doc.status === "warning"
                  ? "bg-amber-500/10 border-amber-500/30"
                  : doc.status === "expired"
                  ? "bg-destructive/15 border-destructive"
                  : "bg-slide-bg border-slide-surface"
              }`}
            >
              <div className="flex justify-between items-start gap-2 mb-1.5">
                <div>
                  <div className="font-bold text-xs text-slide-paper">{doc.name}</div>
                  <div className="text-[10px] text-slide-dim">{doc.issuer}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-black shrink-0 ${
                    doc.status === "warning"
                      ? "bg-amber-400 text-black animate-pulse"
                      : doc.status === "expired"
                      ? "bg-destructive text-white"
                      : "bg-slide-ok text-slide-accent-ink"
                  }`}
                >
                  {doc.status === "warning"
                    ? `Expira em ${doc.daysRemaining}d`
                    : doc.status === "expired"
                    ? "Expirado"
                    : "Em Dia ✓"}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slide-surface/50 text-[11px]">
                <span className="font-mono text-slide-dim">{doc.docNumber}</span>
                {doc.status !== "valid" ? (
                  <button
                    onClick={() => handleRenew(doc.id)}
                    className="font-bold text-slide-accent underline cursor-pointer hover:opacity-80"
                  >
                    Renovar Agora
                  </button>
                ) : (
                  <span className="text-slide-dim">Válido até {doc.expiryDate}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-slide-accent text-slide-accent-ink py-2.5 text-xs font-black shadow hover:opacity-90 transition cursor-pointer"
        >
          Fechar Gestão de Documentos
        </button>
      </div>
    </div>
  );
}
