import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const VALID_TARGETS = new Set(['hub', 'client', 'driver', 'admin', 'school']);
const ALL_BUILD_TARGETS = ['client', 'driver', 'admin', 'school', 'hub'];

const MOBILE_TARGET_CONFIG = {
  client: {
    bundleId: 'ao.mobuss.client',
    displayName: 'MôBuss Cliente',
  },
  driver: {
    bundleId: 'ao.mobuss.driver',
    displayName: 'MôBuss Motorista',
  },
};

function runOrExit(cmd, args, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: process.platform === 'win32' && !cmd.endsWith('node') && cmd !== process.execPath,
  });

  if (result.error) {
    console.error(`Command failed (${cmd}):`, result.error.message);
    process.exit(1);
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
}

function resolveViteCli() {
  const viteBin = path.join(ROOT_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
  if (fs.existsSync(viteBin)) {
    return { cmd: process.execPath, args: [viteBin] };
  }
  return { cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx', args: ['vite'] };
}

function resolveTsxCli() {
  const tsxBin = path.join(ROOT_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  if (fs.existsSync(tsxBin)) {
    return { cmd: process.execPath, args: [tsxBin] };
  }
  return { cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx', args: ['tsx'] };
}

function normalizeTarget(raw, fallback = 'hub') {
  const normalized = (raw || '').toLowerCase().trim();
  if (VALID_TARGETS.has(normalized)) return normalized;
  if (!raw) return fallback;
  console.error(`Invalid MôBuss target "${raw}". Expected one of: client, driver, admin, school, hub.`);
  process.exit(1);
}

function syncIosXcconfig(target) {
  const cfg = MOBILE_TARGET_CONFIG[target];
  if (!cfg) return;
  const xcconfigPath = path.join(ROOT_DIR, 'ios', 'mobuss.xcconfig');
  const content = [
    '// Auto-updated by scripts/mobuss-cli.mjs during cap:sync',
    `MOBUSS_BUNDLE_ID = ${cfg.bundleId}`,
    `MOBUSS_DISPLAY_NAME = ${cfg.displayName}`,
    '',
  ].join('\n');
  fs.writeFileSync(xcconfigPath, content, 'utf8');
}

function buildTarget(target) {
  const vite = resolveViteCli();
  console.log(`\n[MôBuss] Building target "${target}" -> dist/${target}`);
  runOrExit(vite.cmd, [...vite.args, 'build'], { VITE_APP_TARGET: target });
}

const [, , command, arg1, arg2] = process.argv;

if (command === 'dev') {
  const target = normalizeTarget(arg1 || process.env.VITE_APP_TARGET, 'hub');
  const tsx = resolveTsxCli();
  console.log(`[MôBuss] Starting dev server for target "${target}"`);
  runOrExit(tsx.cmd, [...tsx.args, 'server.ts'], {
    NODE_ENV: process.env.NODE_ENV === 'production' ? 'development' : (process.env.NODE_ENV || 'development'),
    VITE_APP_TARGET: target,
    MOBUSS_WEB_TARGET: target,
  });
} else if (command === 'build') {
  const requested = (arg1 || process.env.VITE_APP_TARGET || 'hub').toLowerCase().trim();
  if (requested === 'all') {
    for (const target of ALL_BUILD_TARGETS) {
      buildTarget(target);
    }
    console.log('\n[MôBuss] Built all 5 targets: dist/client, dist/driver, dist/admin, dist/school, dist/hub');
  } else {
    buildTarget(normalizeTarget(requested, 'hub'));
  }
} else if (command === 'cap-sync') {
  const target = normalizeTarget(arg1, 'client');
  if (target !== 'client' && target !== 'driver') {
    console.error('Capacitor sync is only supported for "client" or "driver" mobile targets.');
    process.exit(1);
  }
  buildTarget(target);
  syncIosXcconfig(target);

  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const capArgs = ['cap', 'sync'];
  if (arg2 === 'android' || arg2 === 'ios') {
    capArgs.push(arg2);
  }
  console.log(`[MôBuss] Syncing Capacitor native apps for "${target}" (${MOBILE_TARGET_CONFIG[target].bundleId})`);
  runOrExit(npxCmd, capArgs, { VITE_APP_TARGET: target });
} else if (command === 'clean') {
  for (const relPath of ['dist', 'dev-dist', 'server.js']) {
    fs.rmSync(path.join(ROOT_DIR, relPath), { recursive: true, force: true });
  }
  console.log('[MôBuss] Cleaned dist/, dev-dist/, and server.js');
} else {
  console.error('Usage: node scripts/mobuss-cli.mjs <dev|build|cap-sync|clean> [target]');
  process.exit(1);
}
