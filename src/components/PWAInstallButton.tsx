import { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // If already running as an installed PWA / APK, hide the install button
  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => {
          if (isInstallable) {
            install();
          } else if (isIOS) {
            setShowIOSGuide(true);
          } else {
            setShowModal(true);
          }
        }}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:opacity-95 transition cursor-pointer"
        title="Instalar TransiGo no seu dispositivo Android / Telemóvel"
      >
        <span className="text-sm">⬇️</span>
        <span className="hidden sm:inline">Instalar App (APK)</span>
        <span className="sm:hidden">Instalar</span>
      </button>

      {/* Manual Android APK / Installation Guide Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-slide-paper-ink text-slide-paper p-6 shadow-2xl border border-slide-surface">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-slide-accent text-slide-accent-ink grid place-items-center font-bold text-xl">
                T
              </div>
              <div>
                <h3 className="text-lg font-bold">Instalar TransiGo no Telemóvel</h3>
                <p className="text-xs text-slide-dim">Opções para ter a app no ecrã principal</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-slide-dim mb-6">
              <div className="rounded-2xl bg-slide-bg p-3.5 border border-slide-surface">
                <div className="font-bold text-slide-paper mb-1 flex items-center gap-2">
                  <span>⚡ 1. Instalação Imediata no Android</span>
                  <span className="text-[10px] bg-slide-ok text-slide-accent-ink px-2 py-0.5 rounded-full font-bold">
                    Recomendado
                  </span>
                </div>
                <p className="text-xs">
                  Abra este link no navegador <strong>Google Chrome</strong> do seu telemóvel Android. Toque no menu (<strong>⋮</strong>) e selecione <strong>“Instalar aplicação”</strong> ou <strong>“Adicionar ao ecrã inicial”</strong>. O sistema gera automaticamente um pacote nativo WebAPK!
                </p>
              </div>

              <div className="rounded-2xl bg-slide-bg p-3.5 border border-slide-surface">
                <div className="font-bold text-slide-paper mb-1">
                  📦 2. Gerar ficheiro .APK independente
                </div>
                <p className="text-xs">
                  O repositório já está configurado com <strong>Capacitor</strong> e <strong>GitHub Actions</strong> para compilar o ficheiro <code>TransiGo-debug.apk</code>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full rounded-xl bg-slide-accent text-slide-accent-ink py-2.5 text-sm font-bold cursor-pointer hover:opacity-90 transition"
            >
              Compreendi
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari Guide */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-slide-paper-ink text-slide-paper p-6 shadow-2xl border border-slide-surface">
            <h3 className="text-lg font-bold mb-2">Instalar no iPhone / iPad</h3>
            <p className="text-sm text-slide-dim mb-4 leading-relaxed">
              1. Toque no botão <strong>Partilhar</strong> (ícone do quadrado com a seta para cima) na barra do Safari.
              <br />
              2. Desça a lista e toque em <strong>“Adicionar ao Ecrã Principal”</strong>.
            </p>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full rounded-xl bg-slide-accent text-slide-accent-ink py-2.5 text-sm font-bold cursor-pointer hover:opacity-90 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
