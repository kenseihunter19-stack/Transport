import { useState } from 'react';
import { Lock, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LegalComplianceModal, type LegalTab } from '@/components/LegalComplianceModal';

interface AuthGatePanelProps {
  title: string;
  subtitle: string;
  badgeText?: string;
}

export function AuthGatePanel({
  title,
  subtitle,
  badgeText = 'Acesso Protegido · PostgreSQL + RBAC',
}: AuthGatePanelProps) {
  const { signInWithGoogle, signInWithEmail, authError } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);

  async function handleGoogleSignIn() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      await signInWithEmail({ email, password });
    } catch {
      // authError displays feedback
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slide-bg text-slide-ink flex items-center justify-center p-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md rounded-3xl bg-slide-paper-ink border border-white/10 p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/20261117_030824_57b8de0b.jpg"
            alt="MôBuss"
            className="w-11 h-11 rounded-2xl object-cover border border-white/15 bg-black"
          />
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slide-accent">
              {badgeText}
            </div>
            <h1 className="text-xl font-black text-slide-paper leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {title}
            </h1>
          </div>
        </div>

        <p className="text-xs text-slide-dim leading-relaxed">{subtitle}</p>

        <div className="rounded-2xl bg-slide-bg border border-white/10 p-3.5 space-y-1.5 text-xs text-slide-dim">
          <div className="flex items-center gap-2 text-slide-paper font-bold">
            <ShieldCheck className="w-4 h-4 text-slide-ok shrink-0" />
            <span>Acesso Exclusivo a Contas Autorizadas</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            As contas de Encarregado, Motorista e Escola são criadas exclusivamente pela Administração MôBuss. Não é possível criar conta diretamente na app.
          </p>
        </div>

        {authError && (
          <div className="rounded-xl bg-slide-accent/15 border border-slide-accent/40 p-3 text-xs text-red-200">
            {authError}
          </div>
        )}

        {/* Username / Email & Password Login Only (Accounts Created in Admin Panel) */}
        <form onSubmit={handleEmailSubmit} className="space-y-2.5 text-xs">
          <input
            required
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Utilizador ou e-mail (ex: admin)"
            className="w-full rounded-xl bg-slide-bg border border-white/10 px-3.5 py-2.5 text-white outline-none focus:border-slide-accent"
          />
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Palavra-passe"
            className="w-full rounded-xl bg-slide-bg border border-white/10 px-3.5 py-2.5 text-white outline-none focus:border-slide-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-slide-ok text-white py-3 px-4 font-black shadow hover:opacity-95 disabled:opacity-50 transition cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4" />
            <span>{busy ? 'A autenticar...' : 'Entrar com Credenciais'}</span>
          </button>
        </form>

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-slide-dim">
          <div className="h-px flex-1 bg-white/10" />
          <span>ou</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={busy}
          className="w-full rounded-2xl bg-slide-accent text-white py-3 px-4 text-xs font-black shadow-lg hover:opacity-95 active:scale-[0.98] disabled:opacity-50 transition cursor-pointer inline-flex items-center justify-center gap-2"
        >
          {busy ? <Lock className="w-4 h-4 animate-pulse" /> : <LogIn className="w-4 h-4" />}
          <span>{busy ? 'A autenticar sessão...' : 'Entrar com Google (E-mail Autorizado)'}</span>
        </button>

        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slide-dim">
          <button
            type="button"
            onClick={() => setLegalTab('privacy')}
            className="hover:text-white underline cursor-pointer"
          >
            Política de Privacidade
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => setLegalTab('terms')}
            className="hover:text-white underline cursor-pointer"
          >
            Termos de Serviço
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => setLegalTab('deletion')}
            className="hover:text-white underline cursor-pointer"
          >
            Eliminação de Conta
          </button>
        </div>
      </div>

      <LegalComplianceModal
        open={legalTab !== null}
        initialTab={legalTab ?? 'privacy'}
        onClose={() => setLegalTab(null)}
      />
    </div>
  );
}
