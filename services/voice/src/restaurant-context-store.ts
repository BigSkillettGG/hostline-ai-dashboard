import type { VoiceServiceEnv } from "./env";
import {
  demoRestaurantContext,
  type RestaurantFaq,
  type RestaurantKnowledgeSection,
  type RestaurantMenuItem,
  type RestaurantVoiceContext,
} from "./restaurant-context";
import { buildSupabaseServiceHeaders } from "./supabase-headers";

type OnboardingDraftValue = string | boolean | undefined;
type OnboardingDraft = Record<string, OnboardingDraftValue>;

export interface RestaurantContextStore {
  getContext(locationId?: string): Promise<RestaurantVoiceContext>;
}

export interface SupabaseLocationRow {
  id: string;
  name: string | null;
  cuisine: string | null;
  timezone: string | null;
  phone: string | null;
  ai_host_phone: string | null;
  address: string | null;
}

export interface SupabaseAgentConfigRow {
  host_name: string | null;
  greeting_template: string | null;
  escalation_phone_number: string | null;
  reservation_provider: string | null;
  sms_confirmations_enabled: boolean | null;
}

export interface SupabaseOnboardingProfileRow {
  draft: unknown;
}

export interface SupabaseMenuCategoryRow {
  id: string;
  name: string;
}

export interface SupabaseMenuItemRow {
  category_id: string | null;
  name: string;
  description: string | null;
  price_cents: number | null;
  modifiers: unknown;
  available: boolean | null;
}

export interface SupabaseKnowledgeSectionRow {
  title: string | null;
  body: string | null;
  is_active: boolean | null;
}

export interface SupabaseFaqRow {
  question: string | null;
  answer: string | null;
  is_active: boolean | null;
}

export interface BuildRestaurantContextInput {
  agentConfig?: SupabaseAgentConfigRow | null;
  faqs?: SupabaseFaqRow[];
  knowledgeSections?: SupabaseKnowledgeSectionRow[];
  location?: SupabaseLocationRow | null;
  menuCategories?: SupabaseMenuCategoryRow[];
  menuItems?: SupabaseMenuItemRow[];
  onboardingProfile?: SupabaseOnboardingProfileRow | null;
}

export function createRestaurantContextStore(env: VoiceServiceEnv): RestaurantContextStore {
  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.SUPABASE_DEMO_LOCATION_ID) {
    return new SupabaseRestaurantContextStore({
      defaultLocationId: env.SUPABASE_DEMO_LOCATION_ID,
      key: env.SUPABASE_SECRET_KEY,
      url: env.SUPABASE_URL,
    });
  }

  return new DemoRestaurantContextStore();
}

export function buildRestaurantContext({
  agentConfig,
  faqs = [],
  knowledgeSections = [],
  location,
  menuCategories = [],
  menuItems = [],
  onboardingProfile,
}: BuildRestaurantContextInput): RestaurantVoiceContext {
  const draft = normalizeDraft(onboardingProfile?.draft);
  const restaurantName = stringValue(draft.restaurantName) ?? location?.name?.trim() ?? demoRestaurantContext.restaurantName;
  const hostName = stringValue(draft.hostName) ?? agentConfig?.host_name?.trim() ?? demoRestaurantContext.hostName;
  const timezone = stringValue(draft.timezone) ?? location?.timezone?.trim() ?? demoRestaurantContext.timezone;
  const greetingTemplate =
    stringValue(draft.greeting) ?? agentConfig?.greeting_template?.trim() ?? demoRestaurantContext.greeting;
  const menu = mapMenuItems(menuItems);
  const menuHighlights = menu.length
    ? menu.map((item) => item.name)
    : splitList(stringValue(draft.menuCategories) ?? location?.cuisine ?? "").slice(0, 8);
  const categoryNames = menuCategories.map((category) => category.name).filter(Boolean).join(", ");
  const mappedKnowledgeSections = [
    ...mapKnowledgeSections(knowledgeSections),
    ...buildDraftKnowledgeSections(draft),
  ];
  const locationPolicy =
    location?.address?.trim() ?? stringValue(draft.primaryLocation) ?? "The restaurant address has not been configured yet.";
  const parkingPolicy = stringValue(draft.parking) ?? demoRestaurantContext.policies.parking;

  return {
    defaultPickupEtaMinutes: parseMinutes(stringValue(draft.defaultPickupEta)),
    faqs: mapFaqs(faqs),
    greeting: renderTemplate(greetingTemplate, { hostName, restaurantName }),
    hostName,
    knowledgeSections: mappedKnowledgeSections,
    menuHighlights: menuHighlights.length ? menuHighlights : demoRestaurantContext.menuHighlights,
    menuItems: menu,
    policies: {
      allergies: stringValue(draft.allergyPolicy) ?? demoRestaurantContext.policies.allergies,
      complaints: buildComplaintPolicy(draft),
      delivery: buildDeliveryPolicy(draft),
      delivery_drivers:
        stringValue(draft.deliveryDriverPolicy) ??
        "Delivery drivers should check in at the host stand or pickup counter with the guest name.",
      delivery_issues: buildDeliveryIssuePolicy(draft),
      directions: buildDirectionsPolicy(locationPolicy, parkingPolicy),
      donations_press: stringValue(draft.donationPressPolicy) ?? "",
      dress_code: stringValue(draft.feesAndRules) ?? "",
      escalations: buildEscalationPolicy(draft, agentConfig),
      employment: stringValue(draft.hiringPolicy) ?? "Hiring inquiries should be sent to staff for follow-up.",
      human_handoff: buildHumanHandoffPolicy(draft, agentConfig),
      hours: buildHoursPolicy(draft),
      location: locationPolicy,
      lost_and_found:
        stringValue(draft.lostAndFoundPolicy) ??
        "Collect the item description, visit timing, caller name, and callback number for staff follow-up.",
      menu: buildMenuPolicy(draft, categoryNames),
      order_changes:
        stringValue(draft.orderChangePolicy) ??
        "Order changes and cancellations need staff confirmation before they are promised.",
      parking: parkingPolicy,
      payment: stringValue(draft.paymentPolicy) ?? "Payment is pay at pickup. Do not collect card numbers over the phone.",
      pickup: buildPickupPolicy(draft),
      private_events:
        stringValue(draft.privateEvents) ??
        "Private event, catering, and buyout inquiries should be collected for staff follow-up.",
      reservation_changes:
        stringValue(draft.reservationChangePolicy) ??
        "Reservation changes and cancellations need staff confirmation before they are promised.",
      reservations: buildReservationPolicy(draft, agentConfig),
      sales: buildVendorPolicy(draft),
      waitlist:
        stringValue(draft.waitlistPolicy) ??
        "Live wait times can change quickly, so staff should confirm the wait when the guest arrives.",
    },
    restaurantName,
    smsConfirmationsEnabled: agentConfig?.sms_confirmations_enabled ?? true,
    timezone,
  };
}

class DemoRestaurantContextStore implements RestaurantContextStore {
  async getContext() {
    return demoRestaurantContext;
  }
}

class SupabaseRestaurantContextStore implements RestaurantContextStore {
  private readonly defaultLocationId: string;
  private readonly key: string;
  private readonly restUrl: string;

  constructor({ defaultLocationId, key, url }: { defaultLocationId: string; key: string; url: string }) {
    this.defaultLocationId = defaultLocationId;
    this.key = key;
    this.restUrl = `${url.replace(/\/$/, "")}/rest/v1`;
  }

  async getContext(locationId?: string) {
    const resolvedLocationId = normalizeLocationId(locationId) ?? this.defaultLocationId;

    try {
      const [locations, agentConfigs, onboardingProfiles, menuCategories, knowledgeSections, faqs] = await Promise.all([
        this.request<SupabaseLocationRow[]>(
          "locations",
          `id=eq.${encodeURIComponent(resolvedLocationId)}&limit=1&select=id,name,cuisine,timezone,phone,ai_host_phone,address`,
        ),
        this.request<SupabaseAgentConfigRow[]>(
          "agent_configs",
          `location_id=eq.${encodeURIComponent(resolvedLocationId)}&limit=1&select=host_name,greeting_template,escalation_phone_number,reservation_provider,sms_confirmations_enabled`,
        ),
        this.request<SupabaseOnboardingProfileRow[]>(
          "onboarding_profiles",
          `location_id=eq.${encodeURIComponent(resolvedLocationId)}&limit=1&select=draft`,
        ),
        this.request<SupabaseMenuCategoryRow[]>(
          "menu_categories",
          `location_id=eq.${encodeURIComponent(resolvedLocationId)}&select=id,name`,
        ),
        this.request<SupabaseKnowledgeSectionRow[]>(
          "knowledge_sections",
          `location_id=eq.${encodeURIComponent(resolvedLocationId)}&is_active=eq.true&select=title,body,is_active`,
        ),
        this.request<SupabaseFaqRow[]>(
          "faqs",
          `location_id=eq.${encodeURIComponent(resolvedLocationId)}&is_active=eq.true&select=question,answer,is_active`,
        ),
      ]);

      const categoryIds = menuCategories.map((category) => category.id);
      const menuItems = categoryIds.length
        ? await this.request<SupabaseMenuItemRow[]>(
            "menu_items",
            `category_id=in.(${categoryIds.map(encodeURIComponent).join(",")})&select=category_id,name,description,price_cents,modifiers,available`,
          )
        : [];

      return buildRestaurantContext({
        agentConfig: agentConfigs[0],
        faqs,
        knowledgeSections,
        location: locations[0],
        menuCategories,
        menuItems,
        onboardingProfile: onboardingProfiles[0],
      });
    } catch (error) {
      console.error("[restaurant-context] falling back to demo context", error);
      return demoRestaurantContext;
    }
  }

  private async request<T>(table: string, query: string) {
    const response = await fetch(`${this.restUrl}/${table}?${query}`, {
      headers: buildSupabaseServiceHeaders(this.key),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase GET ${table} failed: ${response.status} ${body}`);
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as T) : ([] as T);
  }
}

function normalizeDraft(value: unknown): OnboardingDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as OnboardingDraft;
}

function stringValue(value: OnboardingDraftValue) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function buildHoursPolicy(draft: OnboardingDraft) {
  const regularHours = stringValue(draft.regularHours) ?? demoRestaurantContext.policies.hours;
  const holidayExceptions = stringValue(draft.holidayExceptions);
  const servicePeriods = stringValue(draft.servicePeriods);
  const orderingCutoffs = stringValue(draft.orderingCutoffs);
  return [regularHours, servicePeriods && `Service periods: ${servicePeriods}`, holidayExceptions && `Special days: ${holidayExceptions}`, orderingCutoffs && `Ordering cutoffs: ${orderingCutoffs}`]
    .filter(Boolean)
    .join(" ");
}

function buildPickupPolicy(draft: OnboardingDraft) {
  const paymentPolicy = stringValue(draft.paymentPolicy) ?? "Pickup orders are pay at pickup.";
  const defaultPickupEta = stringValue(draft.defaultPickupEta);
  const orderDestination = stringValue(draft.orderDestination);
  return [paymentPolicy, defaultPickupEta && `Default pickup estimate is ${defaultPickupEta}.`, orderDestination && `Orders route to ${orderDestination}.`]
    .filter(Boolean)
    .join(" ");
}

function buildDeliveryPolicy(draft: OnboardingDraft) {
  return stringValue(draft.deliveryPolicy) ?? "Direct delivery policy has not been configured yet.";
}

function buildDeliveryIssuePolicy(draft: OnboardingDraft) {
  const deliveryPolicy = stringValue(draft.deliveryPolicy);
  return [
    deliveryPolicy ?? "For third-party delivery app issues, the fastest refund path is usually through the app.",
    "Collect the guest name, app, order details, issue, and callback number if staff review is needed.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildReservationPolicy(draft: OnboardingDraft, agentConfig?: SupabaseAgentConfigRow | null) {
  const provider = stringValue(draft.reservationProvider) ?? agentConfig?.reservation_provider ?? "manual requests";
  const partyRules = stringValue(draft.partyRules) ?? demoRestaurantContext.policies.reservations;
  const specialReservationDays = stringValue(draft.specialReservationDays);
  return [`Provider or mode: ${provider}.`, partyRules, specialReservationDays && `Special reservation days: ${specialReservationDays}`]
    .filter(Boolean)
    .join(" ");
}

function buildComplaintPolicy(draft: OnboardingDraft) {
  const complaintPolicy = stringValue(draft.complaintPolicy);
  return (
    complaintPolicy ??
    "Apologize, collect the caller name, callback number, order or visit details, and send to a manager without guaranteeing a refund."
  );
}

function buildHumanHandoffPolicy(draft: OnboardingDraft, agentConfig?: SupabaseAgentConfigRow | null) {
  const handoffPolicy = stringValue(draft.humanHandoffPolicy);
  const escalationPhone =
    stringValue(draft.escalationPhone) ??
    stringValue(draft.complaintsManagerPhone) ??
    agentConfig?.escalation_phone_number?.trim();
  return [
    handoffPolicy ?? "Collect the caller name, callback number, reason, and urgency for staff follow-up.",
    escalationPhone && `Default escalation phone is ${escalationPhone}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildVendorPolicy(draft: OnboardingDraft) {
  const vendorCallPolicy = stringValue(draft.vendorCallPolicy);
  const salesEmail = stringValue(draft.salesManagerEmail);
  return [
    vendorCallPolicy ??
      "Collect company, caller name, reason for calling, phone, and email without interrupting service.",
    salesEmail && `Vendor summaries route to ${salesEmail}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildEscalationPolicy(draft: OnboardingDraft, agentConfig?: SupabaseAgentConfigRow | null) {
  const complaintsPhone =
    stringValue(draft.complaintsManagerPhone) ??
    stringValue(draft.escalationPhone) ??
    agentConfig?.escalation_phone_number?.trim();
  const salesEmail = stringValue(draft.salesManagerEmail);
  return [
    complaintsPhone && `Complaints or upset callers go to ${complaintsPhone}.`,
    salesEmail && `Sales or vendor inquiries should be summarized to ${salesEmail}.`,
    stringValue(draft.complaintPolicy) && `Complaint policy: ${stringValue(draft.complaintPolicy)}.`,
    stringValue(draft.vendorCallPolicy) && `Vendor policy: ${stringValue(draft.vendorCallPolicy)}.`,
    stringValue(draft.humanHandoffPolicy) && `Human handoff policy: ${stringValue(draft.humanHandoffPolicy)}.`,
    draft.offerComplaintCallback === true && "Offer a manager callback for complaints.",
    draft.askSalesIntent === true && "Ask vendor callers to identify the sales intent before taking a message.",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildDirectionsPolicy(locationPolicy: string, parkingPolicy: string) {
  return [locationPolicy && `Address: ${locationPolicy}.`, parkingPolicy && `Parking: ${parkingPolicy}`]
    .filter(Boolean)
    .join(" ");
}

function buildMenuPolicy(draft: OnboardingDraft, categoryNames: string) {
  const menuCategories = categoryNames || stringValue(draft.menuCategories);
  const timedPricing = stringValue(draft.timedPricing);
  const drinkRules = stringValue(draft.drinkRules);
  const modifiers = stringValue(draft.modifiers);
  return [
    menuCategories && `Menu categories: ${menuCategories}.`,
    modifiers && `Modifiers: ${modifiers}.`,
    timedPricing && `Timed pricing: ${timedPricing}.`,
    drinkRules && `Drink rules: ${drinkRules}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function mapMenuItems(rows: SupabaseMenuItemRow[]): RestaurantMenuItem[] {
  return rows
    .filter((row) => row.available !== false)
    .map((row) => ({
      aliases: [row.name, ...(row.description ? [row.description] : [])],
      modifiers: normalizeStringArray(row.modifiers),
      name: row.name,
      priceCents: row.price_cents ?? 0,
    }));
}

function mapFaqs(rows: SupabaseFaqRow[]): RestaurantFaq[] {
  return rows
    .filter((row) => row.is_active !== false)
    .map((row) => ({
      answer: row.answer?.trim() ?? "",
      question: row.question?.trim() ?? "",
    }))
    .filter((faq) => faq.question && faq.answer);
}

function mapKnowledgeSections(rows: SupabaseKnowledgeSectionRow[]): RestaurantKnowledgeSection[] {
  return rows
    .filter((row) => row.is_active !== false)
    .map((row) => ({
      body: row.body?.trim() ?? "",
      title: row.title?.trim() ?? "",
    }))
    .filter((section) => section.title && section.body);
}

function buildDraftKnowledgeSections(draft: OnboardingDraft): RestaurantKnowledgeSection[] {
  const sections: RestaurantKnowledgeSection[] = [];

  addDraftSection(sections, "Private events and catering", stringValue(draft.privateEvents));
  addDraftSection(sections, "Order changes and cancellations", stringValue(draft.orderChangePolicy));
  addDraftSection(sections, "Reservation changes and cancellations", stringValue(draft.reservationChangePolicy));
  addDraftSection(sections, "Waitlist and walk-ins", stringValue(draft.waitlistPolicy));
  addDraftSection(sections, "Delivery drivers", stringValue(draft.deliveryDriverPolicy));
  addDraftSection(sections, "Delivery and third-party apps", stringValue(draft.deliveryPolicy));
  addDraftSection(sections, "Complaint and refund handling", stringValue(draft.complaintPolicy));
  addDraftSection(sections, "Lost and found", stringValue(draft.lostAndFoundPolicy));
  addDraftSection(sections, "Jobs and hiring", stringValue(draft.hiringPolicy));
  addDraftSection(sections, "Vendor and sales calls", stringValue(draft.vendorCallPolicy));
  addDraftSection(sections, "Human handoff rules", stringValue(draft.humanHandoffPolicy));
  addDraftSection(sections, "Donations, press, and partnerships", stringValue(draft.donationPressPolicy));
  addDraftSection(sections, "Fees and house rules", stringValue(draft.feesAndRules));
  addDraftSection(sections, "Common FAQs", stringValue(draft.customFaqs));

  return sections;
}

function addDraftSection(sections: RestaurantKnowledgeSection[], title: string, body?: string) {
  if (body) sections.push({ body, title });
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return strings.length ? strings : undefined;
}

function splitList(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMinutes(value?: string) {
  if (!value) return undefined;
  const minutes = Number.parseInt(value, 10);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : undefined;
}

function renderTemplate(template: string, values: { hostName: string; restaurantName: string }) {
  return template
    .replaceAll("{restaurant_name}", values.restaurantName)
    .replaceAll("{host_name}", values.hostName);
}

function normalizeLocationId(locationId?: string) {
  if (!locationId || locationId === "demo-location") return undefined;
  return locationId;
}
