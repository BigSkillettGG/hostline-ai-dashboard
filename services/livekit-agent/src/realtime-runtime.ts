import { findBusinessLink, normalizeCustomerRequestKind } from "../../../src/domain/business-links";
import { getRuntimeBusinessProfile } from "../../voice/src/business-runtime";
import type { CallStore } from "../../voice/src/call-store";
import type { VoiceServiceEnv } from "../../voice/src/env";
import type { GuestConfirmationService } from "../../voice/src/guest-confirmation-service";
import type { StaffAlertKind, StaffNotificationService } from "../../voice/src/notification-service";
import type { RestaurantVoiceContext } from "../../voice/src/restaurant-context";
import { buildRestaurantInstructions } from "../../voice/src/restaurant-agent";
import type { ReservationPlatformService } from "../../voice/src/reservation-platform-service";

export function buildLiveKitRealtimeInstructions(
  context: RestaurantVoiceContext,
  callContext: { callerPhone?: string; now?: Date } = {},
) {
  const profile = getRuntimeBusinessProfile(context);
  const localTimeContext = buildBusinessLocalTimeContext(context, callContext.now);
  const callerPhoneContext = callContext.callerPhone
    ? `Caller phone number from caller ID: ${callContext.callerPhone}. If the caller asks for a text or agrees to a confirmation, you may text this number. If offering a text, say the last four digits, not the full number.`
    : "Caller phone number is not available. Ask for the best mobile number before offering to text confirmations.";
  const lookupTool = profile.isRestaurant ? "lookup_restaurant_context" : "lookup_business_context";

  return [
    buildRestaurantInstructions(context),
    `Current ${profile.businessNoun} local time: ${localTimeContext}. Use this for today, tonight, tomorrow, open-now, after-hours, and booking-date questions.`,
    callerPhoneContext,
    "This is one continuous live phone call. Never restart the opening greeting in the middle of the call.",
    `Opening greeting to use when the call begins: "${buildShortOpeningGreeting(context)}"`,
    "Say the opening greeting once at the start of the call, exactly as written. Do not add your name. Do not say you are virtual or AI.",
    "Voice style: bright, upbeat, polished, and genuinely delighted to help, like an excellent front desk employee. Avoid IVR cadence, monotone delivery, robotic precision, and long scripted answers.",
    "Make answers feel specific to what the caller just said. Acknowledge any detail they already gave, then ask only for missing details.",
    "When collecting names, addresses, phone numbers, or appointment details, let the caller finish. If they pause after a partial phone number or address, wait instead of saying thanks.",
    "If the caller only says a filler word like um, uh, or hold on, do not treat it as a new request. Give them a moment or gently ask for the missing detail.",
    `Use 'we' when speaking for the ${profile.businessNoun}.`,
    "Use natural acknowledgements like Sure, Absolutely, Of course, One moment, and Let me check that when they fit.",
    "Noisy-room behavior: ignore TV audio, background conversations, faint echoes, room noise, and your own voice coming back through the caller's phone. Only treat clear directed human speech as caller intent.",
    "Echo guardrail: if caller audio appears to repeat your own greeting or phrases like thank you for calling or how can I help you, treat it as echo. Do not repeat the greeting.",
    "Handle clear interruptions gracefully. If the caller clearly cuts you off with speech, answer their latest request. Do not restart the call because of noise, echo, or a short silence.",
    "If audio is too unclear to understand, do not guess. Say briefly that it is too noisy to hear clearly and ask them to move somewhere quieter, call back, or let staff follow up.",
    `Use the ${lookupTool} tool for hours, service area, directions, services, appointment policy, quote policy, payment, safety, complaints, vendors, links, or anything policy-like.`,
    "If you do not know an answer after checking context, do not guess. Offer a staff callback and collect the missing name, callback number, and question.",
    "There is no live staff transfer in this pilot. Never say you are connecting, transferring, or placing the caller on hold for staff.",
    "When a caller needs staff, use request_staff_callback, then say you are sending the message to staff and someone will call them back shortly.",
    "After answering any normal question or completing any task, ask a short loop-closing question such as 'Can I help you with anything else?' unless the caller has already clearly said goodbye.",
    "Never end the call immediately after answering a question. The call should only close after the caller indicates they are done.",
    "If the caller says no, no thanks, that's all, that's it, I'm good, or similar after your anything-else question, call finish_call with a short closing line like 'Thanks for calling. Goodbye.'",
    "Do not call finish_call until the caller clearly indicates they are done or says goodbye.",
    "When finish_call returns ok, say only the closing line, then stop speaking. The call will end.",
    buildBusinessLinksInstruction(context),
    buildReservationInstruction(context),
    buildOrderInstruction(context),
  ].filter(Boolean).join("\n");
}

export function lookupLiveKitBusinessContext(context: RestaurantVoiceContext, rawTopic: unknown) {
  const profile = getRuntimeBusinessProfile(context);
  const topic = stringValue(rawTopic)?.toLowerCase() ?? "";
  const offeringMatches = findOfferingMatches(context, topic);
  const faqMatches = context.faqs.filter((faq) => textMatchesTopic(`${faq.question} ${faq.answer}`, topic)).slice(0, 5);
  const knowledgeMatches = context.knowledgeSections
    .filter((section) => textMatchesTopic(`${section.title} ${section.body}`, topic))
    .slice(0, 6);
  const policyMatches = Object.entries(context.policies)
    .filter(([key, value]) => textMatchesTopic(`${key} ${value}`, topic))
    .slice(0, 8);

  return {
    businessName: context.restaurantName,
    businessType: profile.businessType,
    currentBusinessTime: buildBusinessLocalTimeContext(context),
    faqs: faqMatches,
    knowledgeSections: knowledgeMatches,
    matchedOfferingItems: offeringMatches.slice(0, 12).map(formatOfferingLookupItem),
    offeringHighlights: context.menuHighlights,
    offeringItems: context.menuItems.slice(0, 30).map(formatOfferingLookupItem),
    policies: policyMatches.length ? Object.fromEntries(policyMatches) : context.policies,
    profile: {
      appointmentNoun: profile.appointmentNoun,
      businessNoun: profile.businessNoun,
      customerNoun: profile.customerNoun,
      offeringNoun: profile.offeringNoun,
      staffNoun: profile.staffNoun,
    },
    topic,
  };
}

export function lookupLiveKitRestaurantContext(context: RestaurantVoiceContext, rawTopic: unknown) {
  return {
    ...lookupLiveKitBusinessContext(context, rawTopic),
    currentRestaurantTime: buildBusinessLocalTimeContext(context),
    menuHighlights: context.menuHighlights,
    restaurantName: context.restaurantName,
  };
}

export function finishLiveKitCall({
  lastCallerText,
  rawArguments,
}: {
  lastCallerText?: string;
  rawArguments: Record<string, unknown>;
}) {
  const closingLine = sanitizeClosingLine(stringValue(rawArguments.closing_line) ?? "Thanks for calling. Goodbye.");
  const reason = stringValue(rawArguments.reason) ?? "caller_done";
  if (lastCallerText && !canFinishAfterCallerTurn(lastCallerText, reason)) {
    return {
      ok: false,
      action: "finish_call",
      error: "caller_not_done",
      callerGuidance:
        "The caller has not clearly said they are done. Do not end the call yet. Confirm the completed task, then ask: 'Can I help you with anything else?'",
      lastCallerText,
    };
  }

  return {
    ok: true,
    action: "finish_call",
    closingLine,
    reason,
    message: `Say only this closing line, then stop speaking: "${closingLine}"`,
  };
}

export async function createLiveKitReservationRequest({
  callRecordId,
  callStore,
  callerPhone,
  context,
  locationId,
  rawArguments,
  reservationPlatformService,
}: {
  callRecordId?: string;
  callStore?: CallStore;
  callerPhone?: string;
  context: RestaurantVoiceContext;
  locationId?: string;
  rawArguments: Record<string, unknown>;
  reservationPlatformService?: ReservationPlatformService;
}) {
  const date = stringValue(rawArguments.reservation_date);
  const time = normalizeReservationTime(stringValue(rawArguments.reservation_time));
  const partySize = numberValue(rawArguments.party_size);
  const guestName = normalizeGuestName(stringValue(rawArguments.guest_name));
  const callbackPhone = normalizeCallerPhone(stringValue(rawArguments.phone_number) ?? callerPhone);
  const missing = [
    !date && "reservation_date",
    !time && "reservation_time",
    !partySize && "party_size",
    !guestName && "guest_name",
  ].filter((item): item is string => Boolean(item));

  if (!date || !time || !partySize || !guestName) {
    return {
      ok: false,
      error: "missing_reservation_details",
      message: `Ask only for the missing reservation details: ${missing.join(", ")}.`,
      missing,
    };
  }

  const reservationSettings = context.reservationSettings;
  if (!reservationSettings.enabled || reservationSettings.handlingMode === "disabled") {
    return {
      ok: false,
      error: "reservations_disabled",
      message: "Tell the caller reservations are not available through this line. Offer staff follow-up if needed.",
      status: "disabled",
    };
  }

  if (reservationSettings.handlingMode === "booking_link" && reservationSettings.bookingUrl) {
    return {
      ok: true,
      bookingUrl: reservationSettings.bookingUrl,
      confirmationMode: "booking_link",
      message: "Offer to text the booking link. Do not say the reservation is confirmed.",
      provider: reservationSettings.provider,
      status: "booking_link_required",
    };
  }

  try {
    const shouldTryProvider = reservationSettings.handlingMode === "integration";
    const platformResult = shouldTryProvider
      ? await reservationPlatformService?.createReservation({
          callId: callRecordId,
          callerPhone: callbackPhone,
          context,
          date,
          guestName,
          locationId,
          notes: stringValue(rawArguments.notes),
          partySize,
          time,
        })
      : undefined;

    const confirmed = platformResult?.ok && platformResult.status === "confirmed";
    const result = await callStore?.createStaffReviewReservation({
      callId: callRecordId,
      callerPhone: callbackPhone,
      confidence: confirmed ? 94 : 88,
      date,
      guestName,
      locationId,
      manualRequest: !confirmed,
      notes: stringValue(rawArguments.notes),
      partySize,
      provider: confirmed ? platformResult.provider : reservationSettings.handlingMode === "hostline_lite_request" ? "hostline_lite" : "manual_request",
      providerReservationId: platformResult?.providerReservationId ?? platformResult?.confirmationCode,
      status: confirmed ? "confirmed" : "pending",
      time,
    });

    return {
      ok: true,
      confirmationCode: platformResult?.confirmationCode,
      confirmationMode: confirmed ? "provider_confirmed" : "staff_confirmed",
      message: confirmed
        ? "Reservation confirmed. Tell the caller it is confirmed and offer to text the confirmation."
        : "Reservation request saved. Tell the caller staff will confirm it shortly; do not guarantee the table until staff confirms.",
      provider: confirmed ? platformResult.provider : "manual_request",
      reservationId: result?.reservationId,
      status: confirmed ? "confirmed" : "pending_staff_confirmation",
    };
  } catch (error) {
    return {
      ok: false,
      error: "reservation_request_failed",
      message: error instanceof Error ? error.message : "Reservation request failed.",
    };
  }
}

export async function createLiveKitCustomerRequest({
  callRecordId,
  callerPhone,
  callStore,
  locationId,
  rawArguments,
}: {
  callRecordId?: string;
  callerPhone?: string;
  callStore?: CallStore;
  locationId?: string;
  rawArguments: Record<string, unknown>;
}) {
  const customerPhone = normalizeCallerPhone(stringValue(rawArguments.callback_phone) ?? callerPhone);
  const summary = stringValue(rawArguments.summary);
  if (!customerPhone) {
    return { ok: false, error: "missing_callback_phone", message: "Ask for the best callback number before saving this request." };
  }
  if (!summary) {
    return { ok: false, error: "missing_summary", message: "Summarize what the customer needs before saving." };
  }

  const requestType = normalizeCustomerRequestKind(rawArguments.request_type);
  const result = await callStore?.createCustomerRequest({
    callId: callRecordId,
    customerName: stringValue(rawArguments.caller_name),
    customerPhone,
    details: normalizeCustomerRequestDetails(rawArguments.details),
    locationId,
    priority: normalizeCustomerRequestPriority(rawArguments.urgency, requestType),
    requestType,
    summary,
  });

  return {
    ok: true,
    message: "Customer request saved. Tell the caller staff will follow up shortly.",
    requestId: result?.requestId,
    requestType,
    status: "customer_request_saved",
    taskId: result?.taskId,
  };
}

export async function sendLiveKitGuestConfirmation({
  callRecordId,
  callerPhone,
  context,
  guestConfirmationService,
  locationId,
  rawArguments,
}: {
  callRecordId?: string;
  callerPhone?: string;
  context: RestaurantVoiceContext;
  guestConfirmationService?: GuestConfirmationService;
  locationId?: string;
  rawArguments: Record<string, unknown>;
}) {
  const phoneNumber = normalizeCallerPhone(stringValue(rawArguments.phone_number) ?? callerPhone);
  if (!phoneNumber) return { ok: false, error: "missing_phone_number", message: "Ask for the best mobile number before texting." };

  const kind = stringValue(rawArguments.kind)?.toLowerCase();
  const message = stringValue(rawArguments.message) ?? "Your request was received.";
  if (kind === "reservation") {
    await guestConfirmationService?.sendReservationConfirmation({
      callId: callRecordId,
      date: stringValue(rawArguments.reservation_date) ?? "requested date",
      guestName: stringValue(rawArguments.guest_name),
      locationId,
      partySize: numberValue(rawArguments.party_size) ?? 0,
      restaurantName: context.restaurantName,
      time: stringValue(rawArguments.reservation_time) ?? "requested time",
      to: phoneNumber,
    });
  } else {
    await guestConfirmationService?.sendTextMessage({
      callId: callRecordId,
      locationId,
      message,
      restaurantName: context.restaurantName,
      threadType: kind === "order" ? "order" : "general",
      to: phoneNumber,
    });
  }

  return {
    ok: true,
    message: "Text confirmation sent.",
    phoneNumber,
    sentToLastFour: phoneNumber.slice(-4),
  };
}

export async function sendLiveKitBusinessLink({
  callRecordId,
  callerPhone,
  context,
  guestConfirmationService,
  locationId,
  rawArguments,
}: {
  callRecordId?: string;
  callerPhone?: string;
  context: RestaurantVoiceContext;
  guestConfirmationService?: GuestConfirmationService;
  locationId?: string;
  rawArguments: Record<string, unknown>;
}) {
  const phoneNumber = normalizeCallerPhone(stringValue(rawArguments.phone_number) ?? callerPhone);
  if (!phoneNumber) return { ok: false, error: "missing_phone_number", message: "Ask for the best mobile number before texting this link." };

  const link = findBusinessLink(context.businessLinks, rawArguments.link_kind);
  if (!link) return { ok: false, error: "missing_business_link", message: "No configured link matches that request. Offer staff follow-up." };

  await guestConfirmationService?.sendTextMessage({
    callId: callRecordId,
    locationId,
    message: `${link.label}: ${link.url}`,
    restaurantName: context.restaurantName,
    threadType: "business_link",
    to: phoneNumber,
  });

  return {
    ok: true,
    link,
    message: `Texted ${link.label}. Tell the caller it is sent.`,
    phoneNumber,
    sentToLastFour: phoneNumber.slice(-4),
  };
}

export async function requestLiveKitStaffCallback({
  callRecordId,
  callerPhone,
  context,
  locationId,
  rawArguments,
  staffNotificationService,
}: {
  callRecordId?: string;
  callerPhone?: string;
  context: RestaurantVoiceContext;
  locationId?: string;
  rawArguments: Record<string, unknown>;
  staffNotificationService?: StaffNotificationService;
}) {
  const callbackPhone = normalizeCallerPhone(stringValue(rawArguments.callback_phone) ?? callerPhone);
  if (!callbackPhone) return { ok: false, error: "missing_callback_phone", message: "Ask for the best callback number before promising staff follow-up." };

  const kind = normalizeStaffCallbackKind(rawArguments.kind);
  const severity = normalizeStaffCallbackSeverity(rawArguments.urgency, kind);
  const callerName = stringValue(rawArguments.caller_name);
  const reason = stringValue(rawArguments.reason) ?? "Caller needs staff follow-up.";
  const question = stringValue(rawArguments.question);
  await staffNotificationService?.sendStaffAlert({
    callId: callRecordId,
    callerPhone: callbackPhone,
    details: [
      callerName && `Caller name: ${callerName}`,
      `Callback: ${callbackPhone}`,
      question && `Question: ${question}`,
      `Reason: ${reason}`,
    ].filter((item): item is string => Boolean(item)),
    kind,
    locationId,
    restaurantName: context.restaurantName,
    severity,
    summary: callerName ? `${callerName}: ${reason}` : reason,
  });

  return {
    ok: true,
    callbackPhone,
    message: "Staff callback request recorded. Tell the caller staff will call them back shortly; do not say you are transferring or placing them on hold.",
    sentToStaff: Boolean(staffNotificationService?.configured),
    status: "callback_requested",
  };
}

export function resolveLiveKitRealtimeSpeed(env: VoiceServiceEnv) {
  const speed = Number.parseFloat(env.OPENAI_REALTIME_SPEED ?? "1.02");
  if (!Number.isFinite(speed)) return 1.02;
  return Math.min(1.12, Math.max(0.9, speed));
}

export function resolveLiveKitRealtimeNoiseReduction(env: VoiceServiceEnv) {
  return env.OPENAI_REALTIME_NOISE_REDUCTION === "near_field" ? "near_field" : "far_field";
}

export function resolveLiveKitRealtimeTurnDetection(env: VoiceServiceEnv) {
  if (env.OPENAI_REALTIME_TURN_DETECTION_MODE === "semantic_vad") {
    const eagerness = env.OPENAI_REALTIME_TURN_EAGERNESS === "medium" || env.OPENAI_REALTIME_TURN_EAGERNESS === "high"
      ? env.OPENAI_REALTIME_TURN_EAGERNESS
      : "low";
    return {
      create_response: true,
      eagerness: eagerness as "low" | "medium" | "high",
      interrupt_response: env.OPENAI_REALTIME_INTERRUPT_RESPONSE === true,
      type: "semantic_vad" as const,
    };
  }

  return {
    create_response: true,
    interrupt_response: env.OPENAI_REALTIME_INTERRUPT_RESPONSE === true,
    prefix_padding_ms: env.OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS,
    silence_duration_ms: env.OPENAI_REALTIME_SERVER_VAD_SILENCE_MS,
    threshold: env.OPENAI_REALTIME_SERVER_VAD_THRESHOLD,
    type: "server_vad" as const,
  };
}

function buildShortOpeningGreeting(context: RestaurantVoiceContext) {
  return `Thank you for calling ${context.restaurantName.replace(/&/g, "and")}. How can I help you?`;
}

function buildBusinessLocalTimeContext(context: RestaurantVoiceContext, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      month: "long",
      timeZone: context.timezone,
      timeZoneName: "short",
      weekday: "long",
      year: "numeric",
    }).format(now);
  } catch {
    return now.toISOString();
  }
}

function buildBusinessLinksInstruction(context: RestaurantVoiceContext) {
  if (!context.businessLinks.length) return "No caller-facing links are configured. Do not invent URLs.";
  return [
    "Configured caller-facing links:",
    ...context.businessLinks.map((link) => `- ${link.kind}: ${link.label} (${link.url})${link.description ? ` - ${link.description}` : ""}`),
    "When callers ask for a configured link, offer to text it and use send_business_link after they agree.",
  ].join("\n");
}

function buildReservationInstruction(context: RestaurantVoiceContext) {
  const settings = context.reservationSettings;
  if (!settings.enabled || settings.handlingMode === "disabled") return "Reservations/appointments are disabled for this business.";
  if (settings.bookingUrl) return `Booking/reservation link: ${settings.bookingUrl}. Use send_business_link if the caller wants it texted.`;
  return "For reservation, appointment, quote, or service requests, collect the missing details and save the request with the matching tool.";
}

function buildOrderInstruction(context: RestaurantVoiceContext) {
  const settings = context.orderSettings;
  if (!settings.enabled || settings.handlingMode === "disabled") return "Ordering is disabled for this business.";
  if (settings.onlineOrderingUrl) return `Online ordering link: ${settings.onlineOrderingUrl}. Use send_business_link if the caller wants it texted.`;
  return "For pickup/order requests, collect details and save a customer request if staff review is needed.";
}

function findOfferingMatches(context: RestaurantVoiceContext, topic: string) {
  const normalizedTopic = normalizeText(topic);
  if (!normalizedTopic) return [];
  return context.menuItems.filter((item) => {
    const candidates = [item.name, ...(item.aliases ?? []), ...(item.modifiers ?? [])].map(normalizeText);
    return candidates.some((candidate) => candidate && (normalizedTopic.includes(candidate) || candidate.includes(normalizedTopic)));
  });
}

function formatOfferingLookupItem(item: RestaurantVoiceContext["menuItems"][number]) {
  return {
    aliases: item.aliases ?? [],
    modifiers: item.modifiers ?? [],
    name: item.name,
    priceCents: item.priceCents,
  };
}

function textMatchesTopic(text: string, topic: string) {
  const normalizedText = normalizeText(text);
  const normalizedTopic = normalizeText(topic);
  if (!normalizedTopic) return true;
  return normalizedText.includes(normalizedTopic) ||
    normalizedTopic.split(/\s+/).filter((word) => word.length >= 3).some((word) => normalizedText.includes(word));
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeCallerPhone(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed || undefined;
}

function normalizeGuestName(value?: string) {
  if (!value) return undefined;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized || /\b(no|none|goodbye|bye|thanks|thank you)\b/i.test(normalized)) return undefined;
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeReservationTime(value?: string) {
  if (!value) return undefined;
  return value.trim().replace(/\s+/g, " ");
}

function normalizeCustomerRequestDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => [key, stringValue(entry) ?? String(entry ?? "")])
      .filter(([, entry]) => entry),
  );
}

function normalizeCustomerRequestPriority(value: unknown, requestType: string) {
  const normalized = stringValue(value)?.toLowerCase();
  if (normalized === "critical" || normalized === "urgent" || normalized === "high") return "high";
  if (normalized === "low") return "low";
  if (["emergency", "complaint"].includes(requestType)) return "high";
  return "normal";
}

function normalizeStaffCallbackKind(value: unknown): StaffAlertKind {
  const normalized = stringValue(value)?.toLowerCase();
  if (normalized === "complaint") return "complaint";
  if (normalized === "large_party" || normalized === "reservation") return "reservation";
  if (normalized === "order_issue" || normalized === "order") return "order";
  if (normalized === "vendor" || normalized === "sales") return "sales";
  if (normalized === "allergy" || normalized === "low_confidence") return "low_confidence";
  return "handoff";
}

function normalizeStaffCallbackSeverity(value: unknown, kind: StaffAlertKind) {
  const normalized = stringValue(value)?.toLowerCase();
  if (normalized === "critical" || normalized === "urgent") return "high";
  if (normalized === "high") return "high";
  if (normalized === "low") return "low";
  if (kind === "complaint" || kind === "reservation" || kind === "order") return "high";
  return "medium";
}

function canFinishAfterCallerTurn(lastCallerText: string, reason: string) {
  if (reason === "silent_or_abandoned" || reason === "wrong_number_complete") return true;
  return isLiveKitCallerDoneUtterance(lastCallerText);
}

export function isLiveKitCallerDoneUtterance(value: string) {
  return isCallerDoneUtterance(normalizeText(value));
}

function isCallerDoneUtterance(normalized: string) {
  if (!normalized) return false;
  if (/^(no|nope|nah|no thanks|no thank you|nothing else|that s all|that is all|that was all|that s it|that is it|that was it|i think that s it|i think that is it|i m good|im good|i am good|i m all good|im all good|we re good|we are good|all good|all set|i m all set|im all set|done|done for now)$/.test(normalized)) {
    return true;
  }
  if (/^(goodbye|bye|thanks|thank you|awesome thanks|awesome thank you|perfect thanks|perfect thank you)$/.test(normalized)) return true;
  return /\b(no thanks|no thank you|nothing else|that s all|that is all|that was all|that s it|that is it|that was it|i think that s it|i think that is it|i m good|im good|i am good|i m all good|im all good|we re good|we are good|all good|all set|done for now|goodbye|bye)\b/.test(normalized);
}

function sanitizeClosingLine(value: string) {
  const sanitized = value.trim().replace(/\s+/g, " ");
  if (!sanitized) return "Thanks for calling. Goodbye.";
  return sanitized.length > 120 ? `${sanitized.slice(0, 117)}...` : sanitized;
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(number) ? number : undefined;
}

function stringValue(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
