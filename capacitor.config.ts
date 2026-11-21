import type { CapacitorConfig } from '@capacitor/cli';

const target = (process.env.VITE_APP_TARGET || 'hub').toLowerCase().trim();

const TARGET_METADATA =
  target === 'client'
    ? { appId: 'ao.mobuss.client', appName: 'MôBuss Cliente' }
    : target === 'driver'
    ? { appId: 'ao.mobuss.driver', appName: 'MôBuss Motorista' }
    : { appId: 'ao.mobuss.app', appName: 'MôBuss' };

const config: CapacitorConfig = {
  appId: TARGET_METADATA.appId,
  appName: TARGET_METADATA.appName,
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#09090b',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#09090b',
  },
};

export default config;
