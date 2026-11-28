export interface QueuedAttendanceEvent {
  eventId: string;
  tripId: number;
  studentId: number;
  studentName?: string;
  eventType: 'boarded' | 'handed_over' | 'absent' | 'present';
  occurredAt: string;
  offlineSequence: number;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface QueuedGpsPoint {
  pointId: string;
  tripId: number;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: string;
  offlineSequence: number;
}

const DB_NAME = 'mobuss_offline_v1';
const STORE_NAME = 'queued_events';
const LOCATION_STORE_NAME = 'queued_locations';
const DB_VERSION = 2;

function openQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB não suportado neste ambiente.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'eventId' });
      }
      if (!db.objectStoreNames.contains(LOCATION_STORE_NAME)) {
        db.createObjectStore(LOCATION_STORE_NAME, { keyPath: 'pointId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Erro ao abrir IndexedDB.'));
  });
}

export async function getQueuedEvents(): Promise<QueuedAttendanceEvent[]> {
  try {
    const db = await openQueueDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as QueuedAttendanceEvent[]) || [];
        items.sort((a, b) => a.offlineSequence - b.offlineSequence);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function enqueueOfflineEvent(item: QueuedAttendanceEvent): Promise<void> {
  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeQueuedEvent(eventId: string): Promise<void> {
  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(eventId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function flushOfflineQueue(
  apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>
): Promise<{ syncedCount: number; remainingCount: number }> {
  const items = await getQueuedEvents();
  let syncedCount = 0;

  for (const ev of items) {
    try {
      await apiFetch(`/api/v1/driver/trips/${ev.tripId}/attendance-events`, {
        method: 'POST',
        body: JSON.stringify({
          eventId: ev.eventId,
          studentId: ev.studentId,
          eventType: ev.eventType,
          occurredAt: ev.occurredAt,
          offlineSequence: ev.offlineSequence,
          latitude: ev.latitude,
          longitude: ev.longitude,
          notes: ev.notes || 'Sincronizado da fila offline IndexedDB',
        }),
      });
      await removeQueuedEvent(ev.eventId);
      syncedCount += 1;
    } catch {
      // Stop flushing on first network/server error to preserve FIFO order
      break;
    }
  }

  const remaining = await getQueuedEvents();
  return { syncedCount, remainingCount: remaining.length };
}

export async function getQueuedLocations(): Promise<QueuedGpsPoint[]> {
  try {
    const db = await openQueueDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(LOCATION_STORE_NAME, 'readonly');
      const store = tx.objectStore(LOCATION_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as QueuedGpsPoint[]) || [];
        items.sort((a, b) => {
          if (a.offlineSequence !== b.offlineSequence) {
            return a.offlineSequence - b.offlineSequence;
          }
          return Date.parse(a.timestamp) - Date.parse(b.timestamp);
        });
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function enqueueOfflineLocation(point: QueuedGpsPoint): Promise<void> {
  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LOCATION_STORE_NAME, 'readwrite');
    tx.objectStore(LOCATION_STORE_NAME).put(point);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeQueuedLocation(pointId: string): Promise<void> {
  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LOCATION_STORE_NAME, 'readwrite');
    tx.objectStore(LOCATION_STORE_NAME).delete(pointId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function flushOfflineLocations(
  apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>
): Promise<{ syncedCount: number; remainingCount: number; lastUploadedAt: string | null }> {
  const items = await getQueuedLocations();
  let syncedCount = 0;
  let lastUploadedAt: string | null = null;

  for (const pt of items) {
    try {
      await apiFetch('/api/v1/driver/location-batches', {
        method: 'POST',
        body: JSON.stringify({
          tripId: pt.tripId,
          latitude: pt.latitude,
          longitude: pt.longitude,
          accuracy: pt.accuracy,
          speed: pt.speed,
          heading: pt.heading,
          timestamp: pt.timestamp,
        }),
      });
      await removeQueuedLocation(pt.pointId);
      syncedCount += 1;
      lastUploadedAt = new Date().toISOString();
    } catch {
      // Stop flushing on first network/server error to preserve FIFO order
      break;
    }
  }

  const remaining = await getQueuedLocations();
  return { syncedCount, remainingCount: remaining.length, lastUploadedAt };
}
