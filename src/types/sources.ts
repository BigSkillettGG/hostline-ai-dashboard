export type SyncFrequency = "hourly" | "daily" | "weekly";
export type SyncStatus = "synced" | "error" | "pending";

export interface MenuSource {
  id: string;
  url: string;
  frequency: SyncFrequency;
  lastSyncedAt: string;
  status: SyncStatus;
}

export type EventType = "Live music" | "DJ" | "Trivia" | "Open mic" | "Other";

export interface EntertainmentEvent {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  performer: string;
  type: EventType;
  notes?: string;
}

export interface EntertainmentSource {
  id: string;
  url: string;
  frequency: SyncFrequency;
  lastSyncedAt: string;
  status: SyncStatus;
}
