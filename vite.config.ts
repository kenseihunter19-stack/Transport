import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

type BuildTarget = 'hub' | 'client' | 'driver' | 'admin' | 'school';

function resolveTarget(raw?: string): BuildTarget {
  const normalized = (raw || '').toLowerCase().trim();
  if (
    normalized === 'client' ||
    normalized === 'driver' ||
    normalized === 'admin' ||
    normalized === 'school'
  ) {
    return normalized;
  }
  return 'hub';
}

const TARGET_MANIFEST: Record<
  BuildTarget,
  { name: string; shortName: string; description: string; startUrl: string; title: string }
> = {
  hub: {
    name: 'MôBuss — Transporte Escolar',
    shortName: 'MôBuss',
    description: 'Transporte escolar inteligente e seguro em Luanda, Angola.',
    startUrl: '/?mode=app',
    title: 'MôBuss — Transporte Escolar Inteligente',
  },
  client: {
    name: 'MôBuss Cliente',
    shortName: 'MôBuss',
    description: 'Acompanhamento escolar em tempo real, PIN seguro e pagamentos Multicaixa.',
    startUrl: '/',
    title: 'MôBuss Cliente — Encarregados & Parceiros',
  },
  driver: {
    name: 'MôBuss Motorista',
    shortName: 'Motorista',
    description: 'App oficial do motorista MôBuss: manifesto, GPS ao vivo e validação PIN.',
    startUrl: '/',
    title: 'MôBuss Motorista — App Oficial',
  },
  admin: {
    name: 'MôBuss Admin',
    shortName: 'Admin',
    description: 'Central de operações, contratos, frota, DNVT, finanças e auditoria MôBuss.',
    startUrl: '/',
    title: 'MôBuss Admin — Central de Operações',
  },
  school: {
    name: 'MôBuss Portal Escolar',
    shortName: 'Escola',
    description: 'Portal institucional para escolas parceiras MôBuss em Angola.',
    startUrl: '/',
    title: 'MôBuss Portal Escolar',
  },
};

function targetHtmlPlugin(targetMeta: (typeof TARGET_MANIFEST)[BuildTarget]): Plugin {
  return {
    name: 'mobuss-target-html',
    transformIndexHtml(html) {
      return html
        .replace(/<title>.*?<\/title>/, `<title>${targetMeta.title}</title>`)
        .replace(
          /<meta name="apple-mobile-web-app-title" content=".*?" \/>/,
          `<meta name="apple-mobile-web-app-title" content="${targetMeta.shortName}" />`
        )
        .replace(
          /<meta property="og:title" content=".*?" \/>/,
          `<meta property="og:title" content="${targetMeta.title}" />`
        );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appTarget = resolveTarget(process.env.VITE_APP_TARGET || env.VITE_APP_TARGET);
  const targetMeta = TARGET_MANIFEST[appTarget];

  return {
    define: {
      __MOBUSS_APP_TARGET__: JSON.stringify(appTarget),
    },
    plugins: [
      react(),
      tailwindcss(),
      targetHtmlPlugin(targetMeta),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'assets/aistudio/20261117_030824_57b8de0b.jpg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
        ],
        manifest: {
          id: '/',
          name: targetMeta.name,
          short_name: targetMeta.shortName,
          description: targetMeta.description,
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          orientation: appTarget === 'admin' || appTarget === 'school' ? 'any' : 'portrait',
          start_url: targetMeta.startUrl,
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    build: {
      outDir: path.resolve(import.meta.dirname, 'dist', appTarget),
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
