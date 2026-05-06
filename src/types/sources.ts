export type SyncFrequency = "hourly" | "daily" | "weekly";
export type SyncStatus = "synced" | "error" | "pending" | "processing";
export type MenuSourceType = "url" | "file" | "paste";
export type IngestionJobStatus = "queued" | "processing" | "completed" | "failed";
export type IngestionJobType = "menu_source_sync" | "menu_text_import" | "menu_file_import";

export interface MenuSource {
  fileName?: string;
  id: string;
  label?: string;
  frequency: SyncFrequency;
  lastError?: string;
  lastSyncedAt: string;
  status: SyncStatus;
  type: MenuSourceType;
  url?: string;
}

export interface IngestionJob {
  completedAt?: string;
  createdAt: string;
  errorMessage?: string;
  id: string;
  sourceId?: string;
  status: IngestionJobStatus;
  summary?: string;
  type: IngestionJobType;
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
