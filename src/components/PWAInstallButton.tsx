import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Download, Package, Zap } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showModal, setShowModal] = useState(false);

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
        className="flex items-center gap-2 rounded-xl bg-slide-ok px-3.5 py-2 text-xs font-bold text-white shadow hover:opacity-95 active:scale-[0.98] transition cursor-pointer whitespace-nowrap shrink-0"
        title="Instalar MôBuss no seu dispositivo Android / Telemóvel"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Instalar App (APK)</span>
        <span className="sm:hidden">Instalar</span>
      </button>

      {/* Manual Android APK / Installation Guide Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.16 }}
              className="w-full max-w-md rounded-2xl bg-slide-paper-ink text-slide-paper p-6 shadow-2xl border border-white/10"
            >
              <div className="flex items-center gap-3 mb-4">
                <img
                  src="/assets/aistudio/20261117_030824_57b8de0b.jpg"
                  alt="MôBuss Logo"
                  className="w-11 h-11 rounded-xl object-cover bg-black border border-white/10"
                />
                <div>
                  <h3 className="text-base font-bold">Instalar MôBuss no Telemóvel</h3>
                  <p className="text-xs text-slide-dim">Opções para ter a app no ecrã principal</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-slide-dim mb-6">
                <div className="rounded-xl bg-slide-surface p-3.5 border border-white/10">
                  <div className="font-bold text-slide-paper mb-1 flex items-center gap-2 text-xs">
                    <Zap className="w-3.5 h-3.5 text-slide-ok" />
                    <span>1. Instalação Imediata no Android</span>
                    <span className="text-slide-ok font-semibold">· Recomendado</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    Abra este link no navegador <strong>Google Chrome</strong> do seu telemóvel Android. Toque no menu (<strong>⋮</strong>) e selecione <strong>“Instalar aplicação”</strong> ou <strong>“Adicionar ao ecrã inicial”</strong>. O sistema gera automaticamente um pacote nativo WebAPK.
                  </p>
                </div>

                <div className="rounded-xl bg-slide-surface p-3.5 border border-white/10">
                  <div className="font-bold text-slide-paper mb-1 flex items-center gap-2 text-xs">
                    <Package className="w-3.5 h-3.5 text-slide-accent" />
                    <span>2. Gerar ficheiro .APK independente</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    O repositório já está configurado com <strong>Capacitor</strong> e <strong>GitHub Actions</strong> para compilar o ficheiro <code>MoBuss-debug.apk</code>.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-full rounded-xl bg-slide-accent text-slide-accent-ink py-2.5 text-xs font-bold cursor-pointer hover:opacity-90 active:scale-[0.98] transition"
              >
                Compreendi
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Safari Guide */}
      <AnimatePresence>
        {showIOSGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.16 }}
              className="w-full max-w-sm rounded-2xl bg-slide-paper-ink text-slide-paper p-6 shadow-2xl border border-white/10"
            >
              <h3 className="text-base font-bold mb-2">Instalar no iPhone / iPad</h3>
              <p className="text-xs text-slide-dim mb-4 leading-relaxed">
                1. Toque no botão <strong>Partilhar</strong> (ícone do quadrado com a seta para cima) na barra do Safari.
                <br />
                2. Desça a lista e toque em <strong>“Adicionar ao Ecrã Principal”</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-slide-accent text-slide-accent-ink py-2.5 text-xs font-bold cursor-pointer hover:opacity-90 active:scale-[0.98] transition"
              >
                Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
