export type AppNotificationType =
  | "boarded"
  | "handover_completed"
  | "approaching_stop"
  | "trip_delayed"
  | "incident"
  | "invoice";

export interface AppNotification {
  id: number;
  userId: number;
  type: AppNotificationType | string;
  title: string;
  body: string;
  tripId: number | null;
  studentId: number | null;
  createdAt: string;
  readAt: string | null;
  deliveryStatus: string;
}

export const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  boarded: "Embarque",
  handover_completed: "Entrega Segura",
  approaching_stop: "Aproximação",
  trip_delayed: "Atraso",
  incident: "Ocorrência",
  invoice: "Fatura",
};

export function formatNotificationTimestampPt(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const d = new Date(ms);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("pt-AO", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}
