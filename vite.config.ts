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
    name: 'MôBus — Transporte Escolar',
    shortName: 'MôBus',
    description: 'Transporte escolar inteligente e seguro em Luanda, Angola.',
    startUrl: '/?mode=app',
    title: 'MôBus — Transporte Escolar Inteligente',
  },
  client: {
    name: 'MôBus Cliente',
    shortName: 'MôBus',
    description: 'Acompanhamento escolar em tempo real, PIN seguro e pagamentos Multicaixa.',
    startUrl: '/',
    title: 'MôBus Cliente — Encarregados & Parceiros',
  },
  driver: {
    name: 'MôBus Motorista',
    shortName: 'Motorista',
    description: 'App oficial do motorista MôBus: manifesto, GPS ao vivo e validação PIN.',
    startUrl: '/',
    title: 'MôBus Motorista — App Oficial',
  },
  admin: {
    name: 'MôBus Admin',
    shortName: 'Admin',
    description: 'Central de operações, contratos, frota, DNVT, finanças e auditoria MôBus.',
    startUrl: '/',
    title: 'MôBus Admin — Central de Operações',
  },
  school: {
    name: 'MôBus Portal Escolar',
    shortName: 'Escola',
    description: 'Portal institucional para escolas parceiras MôBus em Angola.',
    startUrl: '/',
    title: 'MôBus Portal Escolar',
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
          'mobus-logo-1024.png',
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
