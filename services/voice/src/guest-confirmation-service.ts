import type { VoiceServiceEnv } from "./env";
import { createMessageThreadStore, type MessageThreadStore, type MessageThreadType } from "./message-thread-store";
import type { CapturedOrderItem } from "./order-intake";

interface GuestThreadMetadata {
  callId?: string;
  locationId?: string;
  signalhostPhone?: string;
}

export interface GuestOrderConfirmationInput {
  callId?: string;
  customerName?: string;
  etaMinutes?: number;
  items: CapturedOrderItem[];
  locationId?: string;
  orderId?: string;
  restaurantName: string;
  signalhostPhone?: string;
  to?: string;
}

export interface GuestReservationConfirmationInput {
  callId?: string;
  date: string;
  guestName?: string;
  locationId?: string;
  partySize: number;
  reservationId?: string;
  restaurantName: string;
  signalhostPhone?: string;
  time: string;
  to?: string;
}

export interface GuestTextMessageInput {
  callId?: string;
  locationId?: string;
  message: string;
  restaurantName: string;
  signalhostPhone?: string;
  threadType?: MessageThreadType;
  to?: string;
}

export interface GuestConfirmationService {
  configured: boolean;
  sendOrderConfirmation(input: GuestOrderConfirmationInput): Promise<void>;
  sendReservationConfirmation(input: GuestReservationConfirmationInput): Promise<void>;
  sendTextMessage(input: GuestTextMessageInput): Promise<void>;
}

export function createGuestConfirmationService(env: VoiceServiceEnv): GuestConfirmationService {
  if (
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    (env.TWILIO_SMS_FROM_NUMBER || env.TWILIO_MESSAGING_SERVICE_SID)
  ) {
    return new TwilioGuestConfirmationService(env);
  }

  return new NoopGuestConfirmationService();
}

export function formatGuestOrderConfirmation(input: GuestOrderConfirmationInput) {
  const customer = input.customerName?.trim();
  const itemSummary = summarizeItems(input.items);
  const eta = input.etaMinutes ? `ETA about ${input.etaMinutes} min.` : undefined;
  const parts = [
    `${input.restaurantName}: Pickup order received${customer ? ` for ${customer}` : ""}.`,
    itemSummary && `Items: ${itemSummary}.`,
    eta,
    "Pay at pickup. Call the restaurant with changes. Reply STOP to opt out.",
  ];

  return truncateSms(parts.filter(Boolean).join(" "));
}

export function formatGuestReservationConfirmation(input: GuestReservationConfirmationInput) {
  const guest = input.guestName?.trim();
  const parts = [
    `${input.restaurantName}: Reservation request received${guest ? ` for ${guest}` : ""}.`,
    `Party of ${input.partySize} on ${input.date} at ${input.time}.`,
    "Staff will confirm shortly. Call the restaurant with changes. Reply STOP to opt out.",
  ];

  return truncateSms(parts.join(" "));
}

export function formatGuestTextMessage(input: GuestTextMessageInput) {
  const message = input.message.trim().replace(/\s+/g, " ");
  return truncateSms(`${input.restaurantName}: ${message} Reply STOP to opt out.`);
}

class NoopGuestConfirmationService implements GuestConfirmationService {
  configured = false;

  async sendOrderConfirmation(input: GuestOrderConfirmationInput) {
    console.info("[guest-confirmations] not configured; order confirmation not sent", {
      itemCount: input.items.length,
      to: input.to,
    });
  }

  async sendReservationConfirmation(input: GuestReservationConfirmationInput) {
    console.info("[guest-confirmations] not configured; reservation confirmation not sent", {
      date: input.date,
      partySize: input.partySize,
      to: input.to,
    });
  }

  async sendTextMessage(input: GuestTextMessageInput) {
    console.info("[guest-confirmations] not configured; text message not sent", {
      messageLength: input.message.length,
      to: input.to,
    });
  }
}

class TwilioGuestConfirmationService implements GuestConfirmationService {
  configured = true;
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly baseUrl: string;
  private readonly messageThreadStore: MessageThreadStore;
  private readonly messagingServiceSid?: string;
  private readonly smsFromNumber?: string;

  constructor(env: VoiceServiceEnv) {
    this.accountSid = env.TWILIO_ACCOUNT_SID ?? "";
    this.authToken = env.TWILIO_AUTH_TOKEN ?? "";
    this.baseUrl = env.TWILIO_API_BASE_URL.replace(/\/$/, "");
    this.messageThreadStore = createMessageThreadStore(env);
    this.messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
    this.smsFromNumber = env.TWILIO_SMS_FROM_NUMBER;
  }

  async sendOrderConfirmation(input: GuestOrderConfirmationInput) {
    const message = formatGuestOrderConfirmation(input);
    const sent = await this.sendSms(input.to, message);
    await this.recordThread(input, {
      body: message,
      providerMessageSid: sent?.sid,
      relatedOrderId: input.orderId,
      threadType: "order",
    });
  }

  async sendReservationConfirmation(input: GuestReservationConfirmationInput) {
    const message = formatGuestReservationConfirmation(input);
    const sent = await this.sendSms(input.to, message);
    await this.recordThread(input, {
      body: message,
      providerMessageSid: sent?.sid,
      relatedReservationId: input.reservationId,
      threadType: "reservation",
    });
  }

  async sendTextMessage(input: GuestTextMessageInput) {
    const message = formatGuestTextMessage(input);
    const sent = await this.sendSms(input.to, message);
    await this.recordThread(input, {
      body: message,
      providerMessageSid: sent?.sid,
      threadType: input.threadType ?? "general",
    });
  }

  private async sendSms(to: string | undefined, message: string) {
    if (!to?.trim()) return undefined;

    const body = new URLSearchParams({
      Body: message,
      To: to.trim(),
    });

    if (this.messagingServiceSid) {
      body.set("MessagingServiceSid", this.messagingServiceSid);
    } else if (this.smsFromNumber) {
      body.set("From", this.smsFromNumber);
    }

    const response = await fetch(
      `${this.baseUrl}/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`,
      {
        body,
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      },
    );

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(`Twilio guest confirmation failed: ${response.status} ${responseBody}`);
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as { from?: string; sid?: string; to?: string }) : undefined;
  }

  private async recordThread(
    input: GuestThreadMetadata & { restaurantName: string; to?: string },
    details: {
      body: string;
      providerMessageSid?: string;
      relatedOrderId?: string;
      relatedReservationId?: string;
      threadType: MessageThreadType;
    },
  ) {
    if (!input.locationId || !input.to) return;

    await this.messageThreadStore.recordOutboundMessage({
      body: details.body,
      customerPhone: input.to,
      locationId: input.locationId,
      providerMessageSid: details.providerMessageSid,
      relatedCallId: input.callId,
      relatedOrderId: details.relatedOrderId,
      relatedReservationId: details.relatedReservationId,
      restaurantName: input.restaurantName,
      signalhostPhone: input.signalhostPhone ?? this.smsFromNumber,
      threadType: details.threadType,
    });
  }
}

function summarizeItems(items: CapturedOrderItem[]) {
  const summary = items
    .slice(0, 4)
    .map((item) => `${item.quantity}x ${item.name}`)
    .join(", ");

  if (!summary) return "";
  return items.length > 4 ? `${summary}, +${items.length - 4} more` : summary;
}

function truncateSms(value: string) {
  return value.length <= 320 ? value : `${value.slice(0, 317)}...`;
}
