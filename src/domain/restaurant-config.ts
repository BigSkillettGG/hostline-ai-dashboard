import type { SignalHostVoiceGender, SignalHostVoiceProfileId } from "./voice-selection";

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

export type OrderMode = "disabled" | "online_link" | "staff_review" | "staff_review_and_link";

export type ReservationMode =
  | "integration"
  | "booking_link"
  | "manual_request"
  | "hostline_lite_request"
  | "hostline_lite_confirm"
  | "disabled";

export type VoiceTone = "warm" | "professional" | "playful";

export type PaymentMode = "pay_at_pickup";

export interface RestaurantAgentConfig {
  hostName: string;
  voiceGender: SignalHostVoiceGender;
  voiceProfileId: SignalHostVoiceProfileId;
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
    mode: OrderMode;
    onlineOrderingUrl?: string;
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

export const orderModeLabels: Record<OrderMode, string> = {
  disabled: "Do not handle orders",
  online_link: "Send online ordering link",
  staff_review: "Capture for staff review",
  staff_review_and_link: "Capture or send link",
};

export const reservationModeLabels: Record<ReservationMode, string> = {
  integration: "Book through integration",
  booking_link: "Send booking link",
  manual_request: "Create manual requests",
  hostline_lite_request: "SignalHost pending requests",
  hostline_lite_confirm: "SignalHost auto-confirm when rules allow",
  disabled: "Do not handle reservations",
};

export const defaultRestaurantAgentConfig: RestaurantAgentConfig = {
  hostName: "Ava",
  voiceGender: "female",
  voiceProfileId: "ava",
  tone: "warm",
  greetingTemplate:
    "Hi, thank you for calling {restaurant_name}. How can I help you?",
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
    mode: "staff_review",
    onlineOrderingUrl: "",
    paymentMode: "pay_at_pickup",
    destinations: ["staff_review", "kitchen_tablet"],
    requireStaffAcceptance: true,
    defaultPickupEtaMinutes: 25,
  },
  reservations: {
    mode: "manual_request",
    provider: "opentable",
    requireStaffConfirmationWithoutIntegration: true,
    maxPartySizeWithoutConfirmation: 6,
  },
};
