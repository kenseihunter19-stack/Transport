import fs from 'node:fs';
import { initializeApp, getApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminApp = getApp();
export const adminAuth = getAuth(adminApp);
export const adminMessaging = getMessaging(adminApp);

export function isPushCredentialsConfigured(): boolean {
  if (adminApp.options.credential) {
    return true;
  }
  const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (gacPath) {
    return fs.existsSync(gacPath);
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT?.trim()) {
    return true;
  }
  // On Cloud Run / GCE metadata ADC may be present; runtime credential errors are also caught safely.
  if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT) {
    return true;
  }
  return false;
}
