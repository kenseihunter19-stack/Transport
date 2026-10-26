/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { MockupView } from "./views/MockupView";
import { AdminView } from "./views/AdminView";
import { DeckView } from "./views/DeckView";
import { ContractRequestPage } from "./views/ContractRequestPage";
import { PWAInstallButton } from "./components/PWAInstallButton";

export type ActiveView = "mockup" | "landing" | "admin" | "deck";

export default function App() {
  const [view, setView] = useState<ActiveView>(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes("solicitar") || hash.includes("landing")) return "landing";
    if (hash.includes("admin")) return "admin";
    if (hash.includes("deck")) return "deck";
    return "mockup"; // Default to simulator as requested
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes("admin")) setView("admin");
      else if (hash.includes("deck")) setView("deck");
      else if (hash.includes("solicitar") || hash.includes("landing")) setView("landing");
      else setView("mockup");
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateTo = (nextView: ActiveView) => {
    setView(nextView);
    window.location.hash =
      nextView === "mockup"
        ? ""
        : nextView === "landing"
        ? "solicitar"
        : nextView;
  };

  return (
    <div className="min-h-screen bg-slide-bg text-slide-ink flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-slide-paper-ink/95 text-slide-paper backdrop-blur border-b border-slide-surface px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo("mockup")}
            className="flex items-center gap-2.5 text-left cursor-pointer hover:opacity-90 transition"
          >
            <div className="w-8 h-8 rounded-xl bg-slide-accent text-slide-accent-ink grid place-items-center font-black text-base shadow">
              T
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-slide-paper text-base" style={{ fontFamily: "var(--font-display)" }}>
                TransiGo
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slide-accent text-slide-accent-ink">
                Luanda · AO
              </span>
            </div>
          </button>
        </div>

        {/* View Switcher Tabs & Install Button */}
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1 bg-slide-surface/90 p-1 rounded-2xl border border-slide-line/20 text-xs">
            <button
              onClick={() => navigateTo("mockup")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                view === "mockup"
                  ? "bg-slide-accent text-slide-accent-ink shadow-sm"
                  : "text-slide-dim hover:text-slide-paper hover:bg-slide-bg/60"
              }`}
              title="Simulador interactivo com chassis iPhone e controlo de perfis lateral"
            >
              <span>📱</span>
              <span>Simulador</span>
            </button>

            <button
              onClick={() => navigateTo("landing")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                view === "landing"
                  ? "bg-slide-accent text-slide-accent-ink shadow-sm"
                  : "text-slide-dim hover:text-slide-paper hover:bg-slide-bg/60"
              }`}
              title="Portal público para escolas e empresas solicitarem contrato"
            >
              <span>📄</span>
              <span className="hidden md:inline">Solicitar Contrato</span>
            </button>

            <button
              onClick={() => navigateTo("admin")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                view === "admin"
                  ? "bg-slide-accent text-slide-accent-ink shadow-sm"
                  : "text-slide-dim hover:text-slide-paper hover:bg-slide-bg/60"
              }`}
            >
              <span>⚙️</span>
              <span className="hidden md:inline">Admin</span>
            </button>

            <button
              onClick={() => navigateTo("deck")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                view === "deck"
                  ? "bg-slide-accent text-slide-accent-ink shadow-sm"
                  : "text-slide-dim hover:text-slide-paper hover:bg-slide-bg/60"
              }`}
            >
              <span>📊</span>
              <span className="hidden md:inline">Slides</span>
            </button>
          </nav>

          <PWAInstallButton />
        </div>
      </header>

      {/* Main View Container */}
      <main className="flex-1 min-h-0">
        {view === "mockup" && (
          <MockupView
            onNavigate={(v) => navigateTo(v === "deck" ? "deck" : v === "admin" ? "admin" : v === "landing" ? "landing" : "mockup")}
          />
        )}
        {view === "landing" && (
          <ContractRequestPage
            onBackToApp={() => navigateTo("mockup")}
          />
        )}
        {view === "admin" && (
          <AdminView
            onNavigate={(v) => navigateTo(v === "deck" ? "deck" : v === "admin" ? "admin" : "mockup")}
          />
        )}
        {view === "deck" && (
          <DeckView
            onNavigate={(v) => navigateTo(v === "deck" ? "deck" : v === "admin" ? "admin" : "mockup")}
          />
        )}
      </main>
    </div>
  );
}
