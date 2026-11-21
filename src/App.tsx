/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect, useState } from "react";
import {
  Building2,
  Bus,
  FileText,
  LogOut,
  Presentation,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";
import { MobileAppEntry } from "./views/MobileAppEntry";
import { LegalDocumentContent, type LegalTab } from "./components/LegalComplianceModal";
import { PWAInstallButton } from "./components/PWAInstallButton";
import { ROLE_LABELS, useAuth } from "./contexts/AuthContext";
import { APP_TARGET } from "./lib/runtime-config";
import { initNativeStatusBar } from "./lib/native-bridge";
import { addSyncedContract } from "./lib/mobuss-sync";

const AdminView = lazy(() => import("./views/AdminView").then((m) => ({ default: m.AdminView })));
const SchoolPortalView = lazy(() => import("./views/SchoolPortalView").then((m) => ({ default: m.SchoolPortalView })));
const ContractRequestPage = lazy(() =>
  import("./views/ContractRequestPage").then((m) => ({ default: m.ContractRequestPage }))
);
const MockupView = lazy(() => import("./views/MockupView").then((m) => ({ default: m.MockupView })));
const DeckView = lazy(() => import("./views/DeckView").then((m) => ({ default: m.DeckView })));

export type ActiveView =
  | "client"
  | "driver"
  | "school"
  | "admin"
  | "landing"
  | "mockup"
  | "deck"
  | "privacy"
  | "terms"
  | "account-deletion";

function resolveLegalRoute(): LegalTab | null {
  const p = window.location.pathname.toLowerCase();
  const h = window.location.hash.toLowerCase();
  if (p.endsWith("/privacy") || p.endsWith("/privacidade") || h.includes("privacy") || h.includes("privacidade")) {
    return "privacy";
  }
  if (p.endsWith("/terms") || p.endsWith("/termos") || h.includes("terms") || h.includes("termos")) {
    return "terms";
  }
  if (p.endsWith("/account-deletion") || p.endsWith("/delete-account") || h.includes("account-deletion") || h.includes("eliminar-conta")) {
    return "deletion";
  }
  return null;
}

function resolveInitialView(): ActiveView {
  const legal = resolveLegalRoute();
  if (legal === "privacy") return "privacy";
  if (legal === "terms") return "terms";
  if (legal === "deletion") return "account-deletion";

  const params = new URLSearchParams(window.location.search);
  const targetParam = params.get("target")?.toLowerCase();
  if (targetParam === "driver") return "driver";
  if (targetParam === "client") return "client";
  if (targetParam === "school") return "school";

  const hash = window.location.hash.toLowerCase();
  if (hash.includes("driver")) return "driver";
  if (hash.includes("school") || hash.includes("escola")) return "school";
  if (hash.includes("admin")) return "admin";
  if (hash.includes("solicitar") || hash.includes("landing")) return "landing";
  if (hash.includes("mockup") || hash.includes("simulador")) return "mockup";
  if (hash.includes("deck") || hash.includes("slides")) return "deck";
  return "client";
}

function ViewFallback() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-slide-bg text-slide-dim grid place-items-center text-xs">
      A carregar módulo MôBuss...
    </div>
  );
}

export default function App() {
  const { isAuthenticated, dbUser, signOut } = useAuth();
  const [view, setView] = useState<ActiveView>(resolveInitialView);

  useEffect(() => {
    initNativeStatusBar();
    const handleRouteChange = () => {
      setView(resolveInitialView());
    };
    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("popstate", handleRouteChange);
    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, []);

  if (view === "privacy" || view === "terms" || view === "account-deletion") {
    const tab: LegalTab = view === "terms" ? "terms" : view === "account-deletion" ? "deletion" : "privacy";
    return (
      <div className="min-h-screen bg-slide-bg text-slide-ink p-4 sm:p-8 flex flex-col justify-center font-sans">
        <div className="max-w-3xl w-full mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, "", "/");
                setView("client");
              }}
              className="text-xs font-bold text-slide-accent hover:underline"
            >
              ← Voltar à Aplicação MôBuss
            </a>
          </div>
          <LegalDocumentContent initialTab={tab} standalone />
        </div>
      </div>
    );
  }

  // Store-targeted binary builds (Capacitor iOS/Android Client or Driver)
  if (APP_TARGET === "client") {
    return (
      <div className="min-h-screen bg-slide-bg text-slide-ink flex flex-col font-sans">
        <MobileAppEntry mode="client" />
      </div>
    );
  }

  if (APP_TARGET === "driver") {
    return (
      <div className="min-h-screen bg-slide-bg text-slide-ink flex flex-col font-sans">
        <MobileAppEntry mode="driver" />
      </div>
    );
  }

  const navigateTo = (nextView: ActiveView) => {
    setView(nextView);
    window.location.hash = nextView === "client" ? "" : nextView === "landing" ? "solicitar" : nextView;
  };

  return (
    <div className="min-h-screen bg-slide-bg text-slide-ink flex flex-col font-sans">
      {/* Top Platform Header */}
      <header className="sticky top-0 z-50 bg-slide-paper-ink/95 text-slide-paper backdrop-blur border-b border-white/10 px-4 sm:px-5 py-2 flex items-center justify-between gap-3">
        <button
          onClick={() => navigateTo("client")}
          className="flex items-center gap-2 text-left cursor-pointer hover:opacity-90 transition whitespace-nowrap shrink-0"
        >
          <img
            src="/assets/aistudio/20261117_030824_57b8de0b.jpg"
            alt="MôBuss Logo"
            className="w-8 h-8 rounded-lg object-cover bg-black border border-white/10"
          />
          <span className="font-extrabold tracking-tight text-slide-paper text-base" style={{ fontFamily: "var(--font-display)" }}>
            MôBuss
          </span>
        </button>

        {/* Primary Operational Targets */}
        <nav className="flex items-center gap-1 bg-slide-surface/90 p-1 rounded-xl border border-white/10 text-xs overflow-x-auto no-scrollbar">
          <button
            onClick={() => navigateTo("client")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
              view === "client" ? "bg-slide-accent text-white" : "text-slide-dim hover:text-white hover:bg-white/5"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>App Cliente</span>
          </button>

          <button
            onClick={() => navigateTo("driver")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
              view === "driver" ? "bg-slide-accent text-white" : "text-slide-dim hover:text-white hover:bg-white/5"
            }`}
          >
            <Bus className="w-3.5 h-3.5" />
            <span>App Motorista</span>
          </button>

          <button
            onClick={() => navigateTo("school")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
              view === "school" ? "bg-slide-accent text-white" : "text-slide-dim hover:text-white hover:bg-white/5"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Portal Escola</span>
          </button>

          <button
            onClick={() => navigateTo("admin")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
              view === "admin" ? "bg-slide-accent text-white" : "text-slide-dim hover:text-white hover:bg-white/5"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin</span>
          </button>

          <button
            onClick={() => navigateTo("landing")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
              view === "landing" ? "bg-slide-accent text-white" : "text-slide-dim hover:text-white hover:bg-white/5"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Solicitar Contrato</span>
          </button>
        </nav>

        {/* Secondary Showcase & Session Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigateTo("mockup")}
            className={`hidden sm:inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition ${
              view === "mockup"
                ? "bg-white/15 border-white/25 text-white"
                : "bg-transparent border-white/10 text-slide-dim hover:text-white"
            }`}
            title="Simulador Interativo iPhone"
          >
            <Smartphone className="w-3 h-3" />
            <span className="hidden xl:inline">Simulador</span>
          </button>

          <button
            onClick={() => navigateTo("deck")}
            className={`hidden sm:inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition ${
              view === "deck"
                ? "bg-white/15 border-white/25 text-white"
                : "bg-transparent border-white/10 text-slide-dim hover:text-white"
            }`}
            title="Slides de Apresentação"
          >
            <Presentation className="w-3 h-3" />
            <span className="hidden xl:inline">Slides</span>
          </button>

          {isAuthenticated && dbUser && (
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slide-surface px-2 sm:px-2.5 py-1 rounded-lg border border-white/10 text-[11px]">
              <span className="hidden md:inline font-bold text-white truncate max-w-[110px]">{dbUser.fullName}</span>
              <span className="hidden lg:inline text-slide-accent font-semibold">· {ROLE_LABELS[dbUser.primaryRole]}</span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1 text-red-300 hover:text-white font-bold cursor-pointer"
                title="Terminar Sessão"
                aria-label="Terminar Sessão"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair</span>
              </button>
            </div>
          )}

          <PWAInstallButton />
        </div>
      </header>

      {/* Main View Container */}
      <main className="flex-1 min-h-0">
        {view === "client" && <MobileAppEntry mode="client" />}
        {view === "driver" && <MobileAppEntry mode="driver" />}

        <Suspense fallback={<ViewFallback />}>
          {view === "school" && <SchoolPortalView />}
          {view === "landing" && (
            <ContractRequestPage
              onBackToApp={() => navigateTo("client")}
              onOpenAdminContracts={() => navigateTo("admin")}
              onSubmitContract={(contract) => {
                addSyncedContract(contract);
              }}
            />
          )}
          {view === "admin" && (
            <AdminView
              onNavigate={(v) => navigateTo(v as ActiveView)}
            />
          )}
          {view === "mockup" && (
            <MockupView
              onNavigate={(v) => navigateTo(v as ActiveView)}
            />
          )}
          {view === "deck" && (
            <DeckView
              onNavigate={(v) => navigateTo(v as ActiveView)}
            />
          )}
        </Suspense>
      </main>
    </div>
  );
}
