import type { VoiceServiceEnv } from "./env";
import { parseMenuText, type ParsedMenuCategory } from "../../../src/domain/menu-ingestion";

export interface MenuIngestionService {
  configured: boolean;
  runNext(input?: RunMenuIngestionInput): Promise<RunMenuIngestionResult>;
}

export interface RunMenuIngestionInput {
  jobId?: string;
  locationId?: string;
}

export interface RunMenuIngestionResult {
  categoryCount?: number;
  errorMessage?: string;
  itemCount?: number;
  jobId?: string;
  processed: boolean;
  reason?: string;
  status?: "completed" | "failed";
  summary?: string;
}

interface SupabaseIngestionJobRow {
  id: string;
  location_id: string;
  source_id: string | null;
  job_type: string | null;
  status: string | null;
  input: unknown;
}

interface SupabaseMenuSourceRow {
  id: string;
  location_id: string;
  source_type: string | null;
  label: string | null;
  url: string | null;
  file_name: string | null;
  sync_frequency: string | null;
}

interface SupabaseMenuCategoryRow {
  id: string;
}

export function createMenuIngestionService(env: VoiceServiceEnv): MenuIngestionService {
  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.SUPABASE_DEMO_LOCATION_ID) {
    return new SupabaseMenuIngestionService({
      defaultLocationId: env.SUPABASE_DEMO_LOCATION_ID,
      key: env.SUPABASE_SECRET_KEY,
      url: env.SUPABASE_URL,
    });
  }

  return new NoopMenuIngestionService();
}

export function extractReadableText(input: string, contentType = "text/html") {
  const isHtml = contentType.toLowerCase().includes("html") || /<([a-z][\w-]*)(\s|>)/i.test(input);
  if (!isHtml) return normalizeExtractedText(input);

  return normalizeExtractedText(
    decodeHtmlEntities(
      input
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "\n")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "\n")
        .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "\n")
        .replace(/<(br|hr)\b[^>]*>/gi, "\n")
        .replace(/<\/(p|div|section|article|li|tr|h[1-6])>/gi, "\n")
        .replace(/<\/(td|th)>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

class NoopMenuIngestionService implements MenuIngestionService {
  configured = false;

  async runNext(): Promise<RunMenuIngestionResult> {
    return {
      processed: false,
      reason: "Supabase is not configured for menu ingestion.",
    };
  }
}

class SupabaseMenuIngestionService implements MenuIngestionService {
  configured = true;
  private readonly defaultLocationId: string;
  private readonly key: string;
  private readonly restUrl: string;

  constructor({ defaultLocationId, key, url }: { defaultLocationId: string; key: string; url: string }) {
    this.defaultLocationId = defaultLocationId;
    this.key = key;
    this.restUrl = `${url.replace(/\/$/, "")}/rest/v1`;
  }

  async runNext(input: RunMenuIngestionInput = {}): Promise<RunMenuIngestionResult> {
    const locationId = normalizeLocationId(input.locationId) ?? this.defaultLocationId;
    const job = await this.findJob({ jobId: input.jobId, locationId });

    if (!job) {
      return {
        processed: false,
        reason: "No queued ingestion jobs found.",
      };
    }

    const source = job.source_id ? await this.findSource(job.source_id) : null;
    const now = new Date().toISOString();
    await this.updateJob(job.id, {
      error_message: null,
      started_at: now,
      status: "processing",
    });
    if (source) {
      await this.updateSource(source.id, {
        last_error: null,
        status: "processing",
        updated_at: now,
      });
    }

    try {
      const rawText = await this.loadJobText(job, source);
      const categories = parseMenuText(rawText);
      const itemCount = countItems(categories);

      if (!itemCount) {
        throw new Error("No menu items with prices were found in this source.");
      }

      await this.replaceMenu(locationId, categories);

      const completedAt = new Date().toISOString();
      const summary = `Imported ${itemCount} item${itemCount === 1 ? "" : "s"} across ${categories.length} categor${categories.length === 1 ? "y" : "ies"}.`;
      await this.updateJob(job.id, {
        completed_at: completedAt,
        result: {
          categoryCount: categories.length,
          itemCount,
          sourceUrl: source?.url,
          summary,
        },
        status: "completed",
      });
      if (source) {
        await this.updateSource(source.id, {
          last_error: null,
          last_synced_at: completedAt,
          status: "synced",
          updated_at: completedAt,
        });
      }

      return {
        categoryCount: categories.length,
        itemCount,
        jobId: job.id,
        processed: true,
        status: "completed",
        summary,
      };
    } catch (error) {
      const completedAt = new Date().toISOString();
      const errorMessage = error instanceof Error ? error.message : "Menu ingestion failed.";
      await this.updateJob(job.id, {
        completed_at: completedAt,
        error_message: errorMessage,
        result: {
          summary: errorMessage,
        },
        status: "failed",
      });
      if (source) {
        await this.updateSource(source.id, {
          last_error: errorMessage,
          status: "error",
          updated_at: completedAt,
        });
      }

      return {
        errorMessage,
        jobId: job.id,
        processed: true,
        status: "failed",
      };
    }
  }

  private async findJob(input: { jobId?: string; locationId: string }) {
    const query = input.jobId
      ? `id=eq.${encodeURIComponent(input.jobId)}&limit=1&select=${ingestionJobSelectColumns}`
      : `location_id=eq.${encodeURIComponent(input.locationId)}&status=eq.queued&order=created_at.asc&limit=1&select=${ingestionJobSelectColumns}`;
    const rows = await this.request<SupabaseIngestionJobRow[]>("ingestion_jobs", { method: "GET", query });
    return rows[0];
  }

  private async findSource(sourceId: string) {
    const rows = await this.request<SupabaseMenuSourceRow[]>("menu_sources", {
      method: "GET",
      query: `id=eq.${encodeURIComponent(sourceId)}&limit=1&select=${menuSourceSelectColumns}`,
    });
    return rows[0] ?? null;
  }

  private async loadJobText(job: SupabaseIngestionJobRow, source: SupabaseMenuSourceRow | null) {
    const inputText = readStringField(job.input, "text");
    if (inputText) return inputText;

    const inputUrl = readStringField(job.input, "url");
    const url = source?.url?.trim() || inputUrl;
    const sourceType = source?.source_type ?? readStringField(job.input, "sourceType") ?? job.job_type;

    if (sourceType === "file" || job.job_type === "menu_file_import") {
      throw new Error("File menu extraction is queued but no file extraction worker is connected yet.");
    }

    if (!url) {
      throw new Error("This ingestion job does not include a URL or pasted menu text.");
    }

    const sourceUrl = assertSupportedSourceUrl(url);
    const response = await fetch(sourceUrl, {
      headers: {
        Accept: "text/html,text/plain;q=0.9,*/*;q=0.8",
        "User-Agent": "HostLineAI/1.0 menu-ingestion",
      },
    });

    if (!response.ok) {
      throw new Error(`Menu source fetch failed with ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (/pdf|image|octet-stream/i.test(contentType)) {
      throw new Error("This source looks like a file. File extraction worker support is not connected yet.");
    }

    return extractReadableText(await response.text(), contentType);
  }

  private async replaceMenu(locationId: string, categories: ParsedMenuCategory[]) {
    await this.request("menu_categories", {
      method: "DELETE",
      query: `location_id=eq.${encodeURIComponent(locationId)}`,
    });

    const insertedCategories = await this.request<SupabaseMenuCategoryRow[]>("menu_categories", {
      body: categories.map((category, index) => ({
        location_id: locationId,
        name: category.name,
        sort_order: index,
      })),
      headers: {
        Prefer: "return=representation",
      },
      method: "POST",
      query: "select=id",
    });

    const itemRows = categories.flatMap((category, categoryIndex) => {
      const insertedCategory = insertedCategories[categoryIndex];
      if (!insertedCategory) return [];

      return category.items.map((item) => ({
        available: item.available,
        category_id: insertedCategory.id,
        description: item.description ?? null,
        modifiers: item.modifiers ?? [],
        name: item.name,
        prep_minutes: item.prepMinutes,
        price_cents: item.priceCents,
        upsell_suggestions: item.upsellSuggestions ?? [],
      }));
    });

    if (itemRows.length) {
      await this.request("menu_items", {
        body: itemRows,
        method: "POST",
      });
    }
  }

  private async updateJob(jobId: string, body: Record<string, unknown>) {
    await this.request("ingestion_jobs", {
      body,
      method: "PATCH",
      query: `id=eq.${encodeURIComponent(jobId)}`,
    });
  }

  private async updateSource(sourceId: string, body: Record<string, unknown>) {
    await this.request("menu_sources", {
      body,
      method: "PATCH",
      query: `id=eq.${encodeURIComponent(sourceId)}`,
    });
  }

  private async request<T = unknown>(
    table: string,
    options: {
      body?: unknown;
      headers?: Record<string, string>;
      method: "DELETE" | "GET" | "PATCH" | "POST";
      query?: string;
    },
  ) {
    const query = options.query ? `?${options.query}` : "";
    const response = await fetch(`${this.restUrl}/${table}${query}`, {
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
      method: options.method,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase ${options.method} ${table} failed: ${response.status} ${body}`);
    }

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }
}

function countItems(categories: ParsedMenuCategory[]) {
  return categories.reduce((sum, category) => sum + category.items.length, 0);
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return namedEntities[entity.toLowerCase()] ?? match;
  });
}

function readStringField(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field.trim() : undefined;
}

function assertSupportedSourceUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Menu sources must use http or https URLs.");
  }

  if (isPrivateHostname(url.hostname)) {
    throw new Error("Menu sources cannot point to localhost or private network addresses.");
  }

  return url.toString();
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  if (normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80")) {
    return true;
  }

  const parts = normalized.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;

  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254) ||
    first === 0
  );
}

function normalizeLocationId(locationId?: string) {
  if (!locationId || locationId === "demo-location") return undefined;
  return locationId;
}

const ingestionJobSelectColumns = "id,location_id,source_id,job_type,status,input";
const menuSourceSelectColumns = "id,location_id,source_type,label,url,file_name,sync_frequency";
