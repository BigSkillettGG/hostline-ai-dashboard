import type { VoiceServiceEnv } from "./env";
import type { CapturedOrderItem } from "./order-intake";

export interface GuestOrderConfirmationInput {
  customerName?: string;
  etaMinutes?: number;
  items: CapturedOrderItem[];
  orderId?: string;
  restaurantName: string;
  to?: string;
}

export interface GuestReservationConfirmationInput {
  date: string;
  guestName?: string;
  partySize: number;
  reservationId?: string;
  restaurantName: string;
  time: string;
  to?: string;
}

export interface GuestTextMessageInput {
  message: string;
  restaurantName: string;
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
  private readonly messagingServiceSid?: string;
  private readonly smsFromNumber?: string;

  constructor(env: VoiceServiceEnv) {
    this.accountSid = env.TWILIO_ACCOUNT_SID ?? "";
    this.authToken = env.TWILIO_AUTH_TOKEN ?? "";
    this.baseUrl = env.TWILIO_API_BASE_URL.replace(/\/$/, "");
    this.messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
    this.smsFromNumber = env.TWILIO_SMS_FROM_NUMBER;
  }

  async sendOrderConfirmation(input: GuestOrderConfirmationInput) {
    await this.sendSms(input.to, formatGuestOrderConfirmation(input));
  }

  async sendReservationConfirmation(input: GuestReservationConfirmationInput) {
    await this.sendSms(input.to, formatGuestReservationConfirmation(input));
  }

  async sendTextMessage(input: GuestTextMessageInput) {
    await this.sendSms(input.to, formatGuestTextMessage(input));
  }

  private async sendSms(to: string | undefined, message: string) {
    if (!to?.trim()) return;

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
