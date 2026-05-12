import type { VoiceServiceEnv } from "./env";
import { normalizeSignalHostVoiceGender } from "../../../src/domain/voice-selection";
import type { BusinessLink } from "../../../src/domain/business-links";
import { normalizeBusinessType } from "../../../src/domain/business-templates";
import {
  demoRestaurantContext,
  toSpokenRestaurantName,
  type RestaurantFaq,
  type RestaurantKnowledgeSection,
  type RestaurantMenuItem,
  type RestaurantOrderMode,
  type RestaurantOrderSettings,
  type RestaurantReservationMode,
  type RestaurantReservationSettings,
  type RestaurantVoiceContext,
} from "./restaurant-context";
import { buildSupabaseServiceHeaders } from "./supabase-headers";

type OnboardingDraftValue = string | boolean | undefined;
type OnboardingDraft = Record<string, OnboardingDraftValue>;
const RESTAURANT_CONTEXT_CACHE_TTL_MS = 5 * 60 * 1000;

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
  reservation_mode: string | null;
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
    return createCachedRestaurantContextStore(
      new SupabaseRestaurantContextStore({
        defaultLocationId: env.SUPABASE_DEMO_LOCATION_ID,
        key: env.SUPABASE_SECRET_KEY,
        url: env.SUPABASE_URL,
      }),
    );
  }

  return new DemoRestaurantContextStore();
}

export function createCachedRestaurantContextStore(
  inner: RestaurantContextStore,
  ttlMs = RESTAURANT_CONTEXT_CACHE_TTL_MS,
): RestaurantContextStore {
  return new CachedRestaurantContextStore(inner, ttlMs);
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
  const restaurantName =
    stringValue(draft.restaurantName) ??
    stringValue(draft.businessName) ??
    location?.name?.trim() ??
    demoRestaurantContext.restaurantName;
  const hostName = stringValue(draft.hostName) ?? agentConfig?.host_name?.trim() ?? demoRestaurantContext.hostName;
  const timezone = stringValue(draft.timezone) ?? location?.timezone?.trim() ?? demoRestaurantContext.timezone;
  const greetingTemplate =
    stringValue(draft.greeting) ?? agentConfig?.greeting_template?.trim() ?? demoRestaurantContext.greeting;
  const menu = mapMenuItems(menuItems);
  const orderSettings = buildOrderSettings(draft);
  const menuHighlights = menu.length
    ? menu.map((item) => item.name)
    : splitList(stringValue(draft.menuCategories) ?? location?.cuisine ?? "").slice(0, 8);
  const categoryNames = menuCategories.map((category) => category.name).filter(Boolean).join(", ");
  const mappedKnowledgeSections = [
    ...mapKnowledgeSections(knowledgeSections),
    ...buildDraftKnowledgeSections(draft),
  ];
  const mappedFaqs = mapFaqs(faqs);
  const locationPolicy =
    location?.address?.trim() ?? stringValue(draft.primaryLocation) ?? "The restaurant address has not been configured yet.";
  const parkingPolicy = stringValue(draft.parking) ?? demoRestaurantContext.policies.parking;
  const reservationSettings = buildReservationSettings(draft, agentConfig);
  const businessLinks = buildBusinessLinks(draft, orderSettings, reservationSettings);

  return {
    businessLinks,
    businessType: normalizeBusinessType(stringValue(draft.businessType)),
    defaultPickupEtaMinutes: parseMinutes(stringValue(draft.defaultPickupEta)) ?? demoRestaurantContext.defaultPickupEtaMinutes,
    faqs: mappedFaqs.length ? mappedFaqs : demoRestaurantContext.faqs,
    greeting: renderTemplate(greetingTemplate, { hostName, restaurantName }),
    hostName,
    knowledgeSections: mappedKnowledgeSections.length ? mappedKnowledgeSections : demoRestaurantContext.knowledgeSections,
    menuHighlights: menuHighlights.length ? menuHighlights : demoRestaurantContext.menuHighlights,
    menuItems: menu.length ? menu : demoRestaurantContext.menuItems,
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
      substitutions: buildSubstitutionPolicy(draft),
      order_changes:
        stringValue(draft.orderChangePolicy) ??
        "Order changes and cancellations need staff confirmation before they are promised.",
      parking: parkingPolicy,
      payment: stringValue(draft.paymentPolicy) ?? "Payment is pay at pickup. Do not collect card numbers over the phone.",
      pickup: buildPickupPolicy(draft, orderSettings),
      private_events:
        stringValue(draft.privateEvents) ??
        "Private event, catering, and buyout inquiries should be collected for staff follow-up.",
      reservation_changes:
        stringValue(draft.reservationChangePolicy) ??
        "Reservation changes and cancellations need staff confirmation before they are promised.",
      reservations: buildReservationPolicy(draft, agentConfig, reservationSettings),
      sales: buildVendorPolicy(draft),
      specials: buildSpecialsPolicy(draft),
      waitlist:
        stringValue(draft.waitlistPolicy) ??
        "Live wait times can change quickly, so staff should confirm the wait when the guest arrives.",
    },
    orderSettings,
    restaurantName,
    reservationSettings,
    smsConfirmationsEnabled: agentConfig?.sms_confirmations_enabled ?? true,
    timezone,
    voiceGender: normalizeSignalHostVoiceGender(draft.voiceGender),
  };
}

class DemoRestaurantContextStore implements RestaurantContextStore {
  async getContext() {
    return demoRestaurantContext;
  }
}

interface CachedRestaurantContextEntry {
  expiresAt: number;
  promise?: Promise<RestaurantVoiceContext>;
  value?: RestaurantVoiceContext;
}

class CachedRestaurantContextStore implements RestaurantContextStore {
  private readonly cache = new Map<string, CachedRestaurantContextEntry>();

  constructor(
    private readonly inner: RestaurantContextStore,
    private readonly ttlMs: number,
  ) {}

  async getContext(locationId?: string) {
    const key = normalizeLocationId(locationId) ?? "__default__";
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached?.value && cached.expiresAt > now) return cached.value;
    if (cached?.promise) return cached.promise;

    const promise = this.inner.getContext(locationId).then(
      (value) => {
        this.cache.set(key, {
          expiresAt: Date.now() + this.ttlMs,
          value,
        });
        return value;
      },
      (error) => {
        this.cache.delete(key);
        throw error;
      },
    );

    this.cache.set(key, {
      expiresAt: now + this.ttlMs,
      promise,
    });

    return promise;
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
          `location_id=eq.${encodeURIComponent(resolvedLocationId)}&limit=1&select=host_name,greeting_template,escalation_phone_number,reservation_mode,reservation_provider,sms_confirmations_enabled`,
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

function buildPickupPolicy(draft: OnboardingDraft, settings = buildOrderSettings(draft)) {
  const paymentPolicy = stringValue(draft.paymentPolicy) ?? "Pickup orders are pay at pickup.";
  const defaultPickupEta = stringValue(draft.defaultPickupEta);
  const orderDestination = stringValue(draft.orderDestination);
  return [
    orderModeInstruction(settings),
    settings.onlineOrderingUrl && `Online ordering link: ${settings.onlineOrderingUrl}.`,
    paymentPolicy,
    defaultPickupEta && `Default pickup estimate is ${defaultPickupEta}.`,
    orderDestination && `Orders route to ${orderDestination}.`,
  ]
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

function buildOrderSettings(draft: OnboardingDraft): RestaurantOrderSettings {
  const handlingMode = normalizeOrderMode(stringValue(draft.orderHandlingMode), draft.takeOrders);

  return {
    enabled: draft.takeOrders !== false && handlingMode !== "disabled",
    handlingMode,
    onlineOrderingUrl: stringValue(draft.onlineOrderingUrl),
  };
}

function normalizeOrderMode(value: string | undefined, takeOrders: OnboardingDraftValue): RestaurantOrderMode {
  if (takeOrders === false) return "disabled";
  const normalized = (value ?? "").toLowerCase();
  if (normalized.includes("do not")) return "disabled";
  if (normalized.includes("also offer") || normalized.includes("capture order and")) return "staff_review_and_link";
  if (normalized.includes("send online") || normalized.includes("ordering link") || normalized.includes("link only")) return "online_link";
  return "staff_review";
}

function orderModeInstruction(settings: RestaurantOrderSettings) {
  if (!settings.enabled || settings.handlingMode === "disabled") return "Do not capture pickup orders unless staff enables ordering.";
  if (settings.handlingMode === "online_link") return "For pickup orders, offer to text the online ordering link instead of manually taking the order.";
  if (settings.handlingMode === "staff_review_and_link") {
    return "For pickup orders, the host may either capture the order for staff review or offer to text the online ordering link, based on caller preference.";
  }
  return "For pickup orders, capture the order details for staff review.";
}

function buildBusinessLinks(
  draft: OnboardingDraft,
  orderSettings: RestaurantOrderSettings,
  reservationSettings: RestaurantReservationSettings,
): BusinessLink[] {
  const links: BusinessLink[] = [];
  const onlineOrderingUrl = orderSettings.onlineOrderingUrl;
  const reservationBookingUrl = reservationSettings.bookingUrl;
  const menuUrl = stringValue(draft.menuUrl);
  const appointmentBookingUrl = stringValue(draft.appointmentBookingUrl);
  const quoteRequestUrl = stringValue(draft.quoteRequestUrl);
  const intakeFormUrl = stringValue(draft.intakeFormUrl);

  if (onlineOrderingUrl) {
    links.push({
      description: "Use this when a caller or chat visitor wants to place an order online.",
      kind: "ordering",
      label: "Online ordering",
      url: onlineOrderingUrl,
    });
  }

  if (reservationBookingUrl) {
    links.push({
      description: "Use this when a caller or chat visitor wants to book or manage a reservation online.",
      kind: "reservation",
      label: "Reservations",
      url: reservationBookingUrl,
    });
  }

  if (appointmentBookingUrl && appointmentBookingUrl !== reservationBookingUrl) {
    links.push({
      description: "Use this when a caller or chat visitor wants to book an appointment or consultation online.",
      kind: "booking",
      label: "Booking",
      url: appointmentBookingUrl,
    });
  }

  if (quoteRequestUrl) {
    links.push({
      description: "Use this when a caller or chat visitor wants to request a quote or estimate online.",
      kind: "quote",
      label: "Quote request",
      url: quoteRequestUrl,
    });
  }

  if (intakeFormUrl) {
    links.push({
      description: "Use this when a caller or chat visitor should fill out an intake form before staff follow-up.",
      kind: "intake",
      label: "Intake form",
      url: intakeFormUrl,
    });
  }

  if (menuUrl) {
    links.push({
      description: "Use this when a caller or chat visitor wants the menu link.",
      kind: "menu",
      label: "Menu",
      url: menuUrl,
    });
  }

  return links;
}

function buildReservationPolicy(
  draft: OnboardingDraft,
  agentConfig: SupabaseAgentConfigRow | null | undefined,
  settings = buildReservationSettings(draft, agentConfig),
) {
  if (!settings.enabled || settings.handlingMode === "disabled") {
    return "Reservations are disabled. Do not collect reservation requests unless staff configures reservations.";
  }

  const provider = labelProvider(settings.provider);
  const partyRules = stringValue(draft.partyRules) ?? demoRestaurantContext.policies.reservations;
  const specialReservationDays = stringValue(draft.specialReservationDays);
  const bookingUrl = settings.bookingUrl;
  const seatingAreas = stringValue(draft.seatingAreas);
  const privateRoomPolicy = stringValue(draft.privateRoomPolicy);
  const depositPolicy = stringValue(draft.depositPolicy);
  const lateArrivalPolicy = stringValue(draft.lateArrivalPolicy);
  const noShowPolicy = stringValue(draft.noShowPolicy);
  const cutoffRules = settings.cutoffRules;
  const largePartyThreshold = settings.largePartyThreshold;
  const autoConfirmPartyLimit = settings.autoConfirmPartyLimit;
  return [
    `Handling mode: ${reservationModeInstruction(settings.handlingMode)}.`,
    `Current workflow: ${settings.sourceToday ?? provider}.`,
    `Provider or system: ${provider}.`,
    bookingUrl && `Booking link: ${bookingUrl}.`,
    autoConfirmPartyLimit && `Auto-confirm limit: parties up to ${autoConfirmPartyLimit}.`,
    largePartyThreshold && `Large-party threshold: ${largePartyThreshold} or more guests.`,
    settings.minNotice && `Minimum notice: ${settings.minNotice}.`,
    settings.maxAdvance && `Advance booking window: ${settings.maxAdvance}.`,
    cutoffRules && `Cutoff rules: ${cutoffRules}.`,
    partyRules,
    seatingAreas && `Seating areas: ${seatingAreas}.`,
    privateRoomPolicy && `Private room policy: ${privateRoomPolicy}.`,
    depositPolicy && `Deposit and card policy: ${depositPolicy}.`,
    lateArrivalPolicy && `Late-arrival policy: ${lateArrivalPolicy}.`,
    noShowPolicy && `No-show and cancellation policy: ${noShowPolicy}.`,
    specialReservationDays && `Special reservation days: ${specialReservationDays}`,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildReservationSettings(
  draft: OnboardingDraft,
  agentConfig?: SupabaseAgentConfigRow | null,
): RestaurantReservationSettings {
  const provider = normalizeReservationProvider(
    stringValue(draft.reservationProvider) ?? agentConfig?.reservation_provider ?? "manual_request",
  );
  const handlingMode = normalizeReservationMode(
    stringValue(draft.reservationHandlingMode) ?? agentConfig?.reservation_mode ?? undefined,
    provider,
    draft.takeReservations,
  );

  return {
    autoConfirmPartyLimit: parsePositiveInteger(stringValue(draft.autoConfirmPartyLimit)) ?? parsePositiveInteger(stringValue(draft.partyRules)),
    bookingUrl: stringValue(draft.reservationBookingUrl),
    cutoffRules: stringValue(draft.reservationCutoffRules),
    enabled: draft.takeReservations !== false && handlingMode !== "disabled",
    handlingMode,
    largePartyThreshold: parsePositiveInteger(stringValue(draft.largePartyThreshold)),
    maxAdvance: stringValue(draft.reservationAdvanceWindow),
    minNotice: stringValue(draft.reservationMinNotice),
    provider,
    sourceToday: stringValue(draft.reservationSourceToday),
  };
}

function normalizeReservationMode(
  value: string | undefined,
  provider: string,
  takeReservations: OnboardingDraftValue,
): RestaurantReservationMode {
  if (takeReservations === false) return "disabled";
  const normalized = (value ?? "").toLowerCase();
  if (normalized === "integration" || normalized.includes("connected reservation system")) {
    return provider === "none" ? "manual_request" : "integration";
  }
  if (normalized === "booking_link" || normalized.includes("booking link") || normalized.includes("send caller")) return "booking_link";
  if (
    normalized === "hostline_lite_request" ||
    normalized.includes("pending request in signalhost") ||
    normalized.includes("pending request in hostline")
  ) return "hostline_lite_request";
  if (
    normalized === "hostline_lite_confirm" ||
    normalized.includes("confirm in signalhost") ||
    normalized.includes("confirm in hostline")
  ) return "hostline_lite_confirm";
  if (normalized === "disabled" || normalized.includes("do not") || normalized.includes("no reservations")) return "disabled";
  return "manual_request";
}

function normalizeReservationProvider(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("open")) return "opentable";
  if (normalized.includes("yelp")) return "yelp_guest_manager";
  if (normalized.includes("seven")) return "sevenrooms";
  if (normalized.includes("resy")) return "resy";
  if (normalized.includes("tock")) return "tock";
  if (normalized.includes("google") || normalized.includes("booking link") || normalized.includes("manual") || normalized.includes("none") || normalized.includes("no reservations")) {
    return "none";
  }
  return normalized.trim() || "none";
}

function reservationModeInstruction(mode: RestaurantReservationMode) {
  if (mode === "integration") return "try the connected reservation provider first, and fall back to staff confirmation if not confirmed";
  if (mode === "booking_link") return "offer to send the caller the booking link instead of promising a table";
  if (mode === "hostline_lite_request") return "save a pending SignalHost reservation request for staff review";
  if (mode === "hostline_lite_confirm") return "confirm in SignalHost only when configured rules allow it; otherwise use staff confirmation";
  if (mode === "disabled") return "do not take reservations";
  return "create a request for staff confirmation";
}

function labelProvider(provider: string) {
  const labels: Record<string, string> = {
    none: "No connected provider",
    opentable: "OpenTable",
    resy: "Resy",
    sevenrooms: "SevenRooms",
    tock: "Tock",
    yelp_guest_manager: "Yelp Guest Manager",
  };
  return labels[provider] ?? provider;
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

function buildSubstitutionPolicy(draft: OnboardingDraft) {
  return (
    stringValue(draft.substitutionPolicy) ??
    "If a caller asks for an off-menu item or unusual substitution, note it as a request only when it is a simple variation of an existing menu item. Staff must confirm availability, price changes, severe allergy accommodations, and anything not clearly listed."
  );
}

function buildSpecialsPolicy(draft: OnboardingDraft) {
  return [
    stringValue(draft.specialsSchedule),
    stringValue(draft.timedPricing) && `Timed pricing: ${stringValue(draft.timedPricing)}.`,
    stringValue(draft.holidayExceptions) && `Special days: ${stringValue(draft.holidayExceptions)}.`,
  ]
    .filter(Boolean)
    .join(" ") || demoRestaurantContext.policies.specials;
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
  addDraftSection(sections, "Menu substitutions and off-menu requests", stringValue(draft.substitutionPolicy));
  addDraftSection(
    sections,
    "Ordering operating model",
    buildPickupPolicy(draft),
  );
  addDraftSection(sections, "Order changes and cancellations", stringValue(draft.orderChangePolicy));
  addDraftSection(sections, "Reservation operating model", buildReservationPolicy(draft, undefined));
  addDraftSection(sections, "Appointment booking link", stringValue(draft.appointmentBookingUrl));
  addDraftSection(sections, "Quote request link", stringValue(draft.quoteRequestUrl));
  addDraftSection(sections, "Intake form link", stringValue(draft.intakeFormUrl));
  addDraftSection(sections, "Reservation changes and cancellations", stringValue(draft.reservationChangePolicy));
  addDraftSection(sections, "Reservation seating and rooms", [stringValue(draft.seatingAreas), stringValue(draft.privateRoomPolicy)].filter(Boolean).join(" "));
  addDraftSection(sections, "Reservation deposits and timing", [stringValue(draft.depositPolicy), stringValue(draft.lateArrivalPolicy), stringValue(draft.noShowPolicy)].filter(Boolean).join(" "));
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

function parsePositiveInteger(value?: string) {
  if (!value) return undefined;
  const match = value.match(/\d+/);
  const parsed = match?.[0] ? Number.parseInt(match[0], 10) : undefined;
  return parsed && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function renderTemplate(template: string, values: { hostName: string; restaurantName: string }) {
  const spokenRestaurantName = toSpokenRestaurantName(values.restaurantName);
  return template
    .replaceAll("{restaurant_name}", spokenRestaurantName)
    .replaceAll("{restaurantName}", spokenRestaurantName)
    .replaceAll("{host_name}", values.hostName)
    .replaceAll("{hostName}", values.hostName);
}

function normalizeLocationId(locationId?: string) {
  if (!locationId || locationId === "demo-location") return undefined;
  return locationId;
}
