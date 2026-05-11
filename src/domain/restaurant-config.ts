import type { HostlineVoiceGender } from "./voice-selection";

export type CallHandlingMode =
  | "answer_immediately"
  | "answer_after_rings"
  | "after_hours_only"
  | "manually_enabled";

export type AfterHoursBehavior =
  | "take_message"
  | "answer_faqs"
  | "orders_and_faqs"
  | "full_service";

export type OrderDestination =
  | "pos"
  | "kitchen_tablet"
  | "printer"
  | "staff_review";

export type ReservationMode =
  | "integration"
  | "manual_request"
  | "disabled";

export type VoiceTone = "warm" | "professional" | "playful";

export type PaymentMode = "pay_at_pickup";

export interface RestaurantAgentConfig {
  hostName: string;
  voiceGender: HostlineVoiceGender;
  tone: VoiceTone;
  greetingTemplate: string;
  disclosureEnabled: boolean;
  callHandlingMode: CallHandlingMode;
  answerAfterRings: number;
  afterHoursBehavior: AfterHoursBehavior;
  escalationPhoneNumber: string;
  capabilities: {
    answerFaqs: boolean;
    takeOrders: boolean;
    handleReservations: boolean;
    sendSmsConfirmations: boolean;
    escalateToStaff: boolean;
  };
  orders: {
    enabled: boolean;
    paymentMode: PaymentMode;
    destinations: OrderDestination[];
    requireStaffAcceptance: boolean;
    defaultPickupEtaMinutes: number;
  };
  reservations: {
    mode: ReservationMode;
    provider: "opentable" | "yelp_guest_manager" | "sevenrooms" | "resy" | "tock" | "none";
    requireStaffConfirmationWithoutIntegration: boolean;
    maxPartySizeWithoutConfirmation: number;
  };
}

export const callHandlingLabels: Record<CallHandlingMode, string> = {
  answer_immediately: "Answer immediately",
  answer_after_rings: "Answer after X rings",
  after_hours_only: "Only outside business hours",
  manually_enabled: "Only when manually enabled",
};

export const afterHoursBehaviorLabels: Record<AfterHoursBehavior, string> = {
  take_message: "Take a message",
  answer_faqs: "Answer FAQs only",
  orders_and_faqs: "Orders and FAQs",
  full_service: "Full service",
};

export const orderDestinationLabels: Record<OrderDestination, string> = {
  pos: "POS integration",
  kitchen_tablet: "Kitchen tablet",
  printer: "Kitchen printer",
  staff_review: "Staff review queue",
};

export const reservationModeLabels: Record<ReservationMode, string> = {
  integration: "Book through integration",
  manual_request: "Create manual requests",
  disabled: "Do not handle reservations",
};

export const defaultRestaurantAgentConfig: RestaurantAgentConfig = {
  hostName: "Vera",
  voiceGender: "female",
  tone: "warm",
  greetingTemplate:
    "Thanks for calling {restaurant_name}, this is Vera, the restaurant's virtual host. How can I help you?",
  disclosureEnabled: true,
  callHandlingMode: "answer_after_rings",
  answerAfterRings: 3,
  afterHoursBehavior: "answer_faqs",
  escalationPhoneNumber: "+1 (415) 555-0199",
  capabilities: {
    answerFaqs: true,
    takeOrders: true,
    handleReservations: true,
    sendSmsConfirmations: true,
    escalateToStaff: true,
  },
  orders: {
    enabled: true,
    paymentMode: "pay_at_pickup",
    destinations: ["staff_review", "kitchen_tablet"],
    requireStaffAcceptance: true,
    defaultPickupEtaMinutes: 25,
  },
  reservations: {
    mode: "integration",
    provider: "opentable",
    requireStaffConfirmationWithoutIntegration: true,
    maxPartySizeWithoutConfirmation: 6,
  },
};
