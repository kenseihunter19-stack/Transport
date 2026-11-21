import { Geolocation } from '@capacitor/geolocation';
import { Network } from '@capacitor/network';
import { PushNotifications } from '@capacitor/push-notifications';
import { StatusBar, Style } from '@capacitor/status-bar';
import { getDevicePlatform, isNativeCapacitor } from './runtime-config';

export interface GeoSample {
  lat: number;
  lng: number;
  accuracy?: number;
  at: string;
}

export function initNativeStatusBar(): void {
  if (!isNativeCapacitor()) return;
  void StatusBar.setStyle({ style: Style.Dark }).catch(() => null);
  void StatusBar.setBackgroundColor({ color: '#09090b' }).catch(() => null);
}

export function watchDeviceLocation(
  onPosition: (pos: GeoSample) => void,
  onError: () => void
): () => void {
  let cancelled = false;

  if (isNativeCapacitor()) {
    let capWatchId: string | null = null;
    (async () => {
      try {
        const perm = await Geolocation.requestPermissions();
        if (cancelled) return;
        if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
          onError();
          return;
        }
        capWatchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
          (position, err) => {
            if (cancelled) return;
            if (err || !position) {
              onError();
              return;
            }
            onPosition({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              at: new Date(position.timestamp || Date.now()).toISOString(),
            });
          }
        );
      } catch {
        if (!cancelled) onError();
      }
    })();

    return () => {
      cancelled = true;
      if (capWatchId) {
        void Geolocation.clearWatch({ id: capWatchId }).catch(() => null);
      }
    };
  }

  // Web browser fallback
  if (!('geolocation' in navigator)) {
    onError();
    return () => {};
  }

  const webWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (cancelled) return;
      onPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        at: new Date().toISOString(),
      });
    },
    () => {
      if (!cancelled) onError();
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
  );

  return () => {
    cancelled = true;
    navigator.geolocation.clearWatch(webWatchId);
  };
}

export function watchDeviceNetwork(onChange: (connected: boolean) => void): () => void {
  if (isNativeCapacitor()) {
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    void Network.getStatus()
      .then((s) => onChange(s.connected))
      .catch(() => null);
    void Network.addListener('networkStatusChange', (status) => {
      onChange(status.connected);
    })
      .then((handle) => {
        listenerHandle = handle;
      })
      .catch(() => null);

    return () => {
      void listenerHandle?.remove().catch(() => null);
    };
  }

  onChange(navigator.onLine);
  const handleOnline = () => onChange(true);
  const handleOffline = () => onChange(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

export function registerNativePush(options: {
  onToken: (token: string, platform: 'ios' | 'android') => void;
  onNotification: (title: string, body: string) => void;
}): () => void {
  const platform = getDevicePlatform();
  if (!isNativeCapacitor() || (platform !== 'ios' && platform !== 'android')) {
    return () => {};
  }

  let disposed = false;
  const handles: Array<{ remove: () => Promise<void> }> = [];

  (async () => {
    try {
      const perm = await PushNotifications.requestPermissions();
      if (disposed || perm.receive !== 'granted') return;

      const regHandle = await PushNotifications.addListener('registration', (token) => {
        if (!disposed && token.value) {
          options.onToken(token.value, platform);
        }
      });
      handles.push(regHandle);

      const recvHandle = await PushNotifications.addListener('pushNotificationReceived', (notif) => {
        if (!disposed) {
          options.onNotification(notif.title || 'MôBuss', notif.body || 'Nova atualização de viagem.');
        }
      });
      handles.push(recvHandle);

      await PushNotifications.register();
    } catch {
      // Push permission declined or simulator without APNs/FCM
    }
  })();

  return () => {
    disposed = true;
    for (const h of handles) {
      void h.remove().catch(() => null);
    }
  };
}
