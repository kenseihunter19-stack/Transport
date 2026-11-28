import { useState } from 'react';
import { FileText, Lock, ShieldCheck, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export type LegalTab = 'privacy' | 'terms' | 'deletion';

interface LegalDocumentContentProps {
  initialTab?: LegalTab;
  onClose?: () => void;
  standalone?: boolean;
}

export function LegalDocumentContent({
  initialTab = 'privacy',
  onClose,
  standalone = false,
}: LegalDocumentContentProps) {
  const { isAuthenticated, dbUser, apiFetch } = useAuth();
  const [tab, setTab] = useState<LegalTab>(initialTab);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmitDeletion(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthenticated) return;
    setSubmitting(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ message: string; referenceId: string }>('/api/v1/auth/deletion-request', {
        method: 'POST',
        body: JSON.stringify({
          reason: reason.trim() || 'Pedido submetido pelo titular da conta na aplicação.',
        }),
      });
      setFeedback(`${res.message} (Ref: ${res.referenceId})`);
      setReason('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível registar o pedido.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`bg-slide-paper-ink text-slide-ink border border-white/15 rounded-3xl overflow-hidden flex flex-col ${
        standalone ? 'w-full max-w-3xl mx-auto shadow-2xl' : 'w-full max-w-2xl max-h-[88vh] shadow-2xl'
      }`}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-black/30">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-slide-accent shrink-0" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slide-accent">
              Conformidade App Store & Google Play · Angola
            </div>
            <h2 className="text-base font-black text-white leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              MôBus — Privacidade, Termos & Eliminação de Conta
            </h2>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-slide-dim hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="px-5 pt-3 pb-2 border-b border-white/10 flex flex-wrap gap-1.5 bg-slide-bg/50 text-xs">
        <button
          type="button"
          onClick={() => setTab('privacy')}
          className={`px-3 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
            tab === 'privacy' ? 'bg-slide-accent text-white' : 'bg-white/5 text-slide-dim hover:text-white'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Política de Privacidade</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('terms')}
          className={`px-3 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
            tab === 'terms' ? 'bg-slide-accent text-white' : 'bg-white/5 text-slide-dim hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Termos de Serviço</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('deletion')}
          className={`px-3 py-1.5 rounded-xl font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
            tab === 'deletion' ? 'bg-slide-accent text-white' : 'bg-white/5 text-slide-dim hover:text-white'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Eliminação de Conta</span>
        </button>
      </div>

      {/* Scrollable Legal Body */}
      <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-slide-dim">
        {tab === 'privacy' && (
          <>
            <div className="text-[11px] font-mono text-slide-dim">
              Responsável pelo Tratamento: <strong className="text-white">MôBuss Angola Transporte Escolar Lda.</strong> · NIF 5417209418 · Luanda, Angola · Última atualização: Novembro de 2026
            </div>

            <section className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">1. Dados Recolhidos e Finalidade</h3>
              <p>
                A plataforma MôBus (aplicações <em>MôBus Cliente</em>, <em>MôBus Motorista</em> e portais escolares) trata apenas os dados estritamente necessários à segurança do transporte escolar:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-white">Identificação e Acesso:</strong> Nome, identificador institucional ou e-mail autorizado, número de telefone e perfil operacional (Encarregado, Motorista, Escola ou Administração).</li>
                <li><strong className="text-white">Dados dos Educandos:</strong> Nome do aluno, escola vinculada, rota atribuída, paragem e registos de embarque/desembarque.</li>
                <li><strong className="text-white">Localização GPS em Tempo Real:</strong> Coordenadas de telemetria da viatura escolar recolhidas pela app do Motorista durante viagens ativas para cálculo de chegada (geofence 500m) e segurança.</li>
                <li><strong className="text-white">Códigos PIN e Segurança:</strong> Códigos PIN de 4 dígitos são armazenados exclusivamente sob a forma de resumo criptográfico (hash), nunca em texto limpo.</li>
                <li><strong className="text-white">Notificações Push:</strong> Token de dispositivo (FCM/APNs) utilizado apenas para alertas de viagem, chegada à paragem, embarque e emergências SOS.</li>
              </ul>
            </section>

            <section className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">2. Partilha e Armazenamento</h3>
              <p>
                A MôBus <strong className="text-white">não vende, não aluga e não partilha dados com redes de publicidade ou terceiros comerciais</strong>. Os registos são transmitidos por ligação encriptada (HTTPS/WSS) e alojados em base de dados gerida com controlo de acesso por função (RBAC) e registo de auditoria.
              </p>
            </section>

            <section className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">3. Direitos dos Titulares (Lei n.º 22/11 de Proteção de Dados)</h3>
              <p>
                Os encarregados, motoristas e colaboradores escolares podem solicitar acesso, retificação, suspensão ou eliminação dos seus dados a qualquer momento através do separador <strong>Eliminação de Conta</strong> ou pelo e-mail <strong className="text-white">privacidade@mobuss.ao</strong>.
              </p>
            </section>
          </>
        )}

        {tab === 'terms' && (
          <>
            <div className="text-[11px] font-mono text-slide-dim">
              Termos Gerais de Utilização · MôBuss Angola Transporte Escolar Lda. · Luanda
            </div>

            <section className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">1. Acesso Restrito e Criação de Contas</h3>
              <p>
                O acesso às aplicações <em>MôBus Cliente</em> e <em>MôBus Motorista</em> é exclusivo a utilizadores previamente autorizados. <strong className="text-white">Não existe registo público autónomo</strong> na aplicação; todas as contas são criadas e geridas exclusivamente pela Administração MôBus em articulação com as instituições de ensino contratantes.
              </p>
            </section>

            <section className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">2. Deveres de Segurança e Handover PIN</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>O Encarregado compromete-se a manter confidencial o código PIN de entrega e a apresentar o código atualizado ao motorista no momento do embarque e desembarque.</li>
                <li>O Motorista obriga-se a validar o PIN no servidor, manter a telemetria GPS ativa durante o trajeto e executar a verificação física de <em>autocarro vazio</em> no final de cada viagem.</li>
              </ul>
            </section>

            <section className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">3. Contratos, Faturação e Suspensão</h3>
              <p>
                Os tarifários escolares e mensalidades são regidos por contrato formal celebrado entre a escola/encarregado e a MôBus Angola. Contas podem ser desativadas pela Administração por término de contrato, solicitação do titular ou incumprimento das normas de segurança infantil.
              </p>
            </section>
          </>
        )}

        {tab === 'deletion' && (
          <>
            <div className="rounded-2xl bg-slide-bg border border-white/10 p-4 space-y-2">
              <h3 className="text-sm font-bold text-white">Política de Eliminação de Conta e Dados</h3>
              <p>
                Como as contas MôBus são provisionadas pela Administração escolar e operacional, pode solicitar a desativação imediata do seu acesso e a eliminação/anonimização dos seus dados pessoais (mantendo apenas registos de auditoria exigidos por lei fiscal e segurança infantil em Angola).
              </p>
            </div>

            {isAuthenticated && dbUser ? (
              <form onSubmit={handleSubmitDeletion} className="rounded-2xl bg-slide-bg border border-white/10 p-4 space-y-3">
                <div className="text-white font-bold">
                  Sessão ativa: {dbUser.fullName} ({dbUser.username || dbUser.email})
                </div>
                <p className="text-[11px]">
                  Ao submeter este pedido, a Administração MôBus recebe um alerta prioritário para desativar a sua conta e remover os tokens de notificação e dados de contacto associados.
                </p>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo opcional (ex.: transferência de escola, fim de ano letivo, remoção de dados)..."
                  className="w-full rounded-xl bg-slide-paper-ink border border-white/10 px-3 py-2 text-white outline-none focus:border-slide-accent"
                />
                {feedback && (
                  <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/35 p-3 text-emerald-200 font-semibold">
                    {feedback}
                  </div>
                )}
                {errorMsg && (
                  <div className="rounded-xl bg-slide-accent/15 border border-slide-accent/35 p-3 text-red-200">
                    {errorMsg}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-slide-accent text-white px-4 py-2.5 font-black cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{submitting ? 'A registar pedido...' : 'Solicitar Eliminação / Desativação da Conta'}</span>
                </button>
              </form>
            ) : (
              <div className="rounded-2xl bg-slide-bg border border-white/10 p-4 space-y-2">
                <div className="text-white font-bold">Como solicitar sem iniciar sessão</div>
                <p>
                  Se já não tiver acesso à aplicação, envie um pedido a partir do e-mail associado à sua conta para{' '}
                  <strong className="text-white">privacidade@mobuss.ao</strong> ou solicite diretamente à secretaria da sua escola parceira em Luanda. O prazo máximo de resposta e conclusão é de 5 dias úteis.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function LegalComplianceModal({
  open,
  initialTab = 'privacy',
  onClose,
}: {
  open: boolean;
  initialTab?: LegalTab;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <LegalDocumentContent initialTab={initialTab} onClose={onClose} />
    </div>
  );
}
