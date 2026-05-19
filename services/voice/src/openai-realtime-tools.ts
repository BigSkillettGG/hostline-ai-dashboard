import { businessLinkKindLabels } from "../../../src/domain/business-links";
import type { TrustedContact } from "../../../src/domain/trusted-contacts";
import { buildBusinessTranscriptionPrompt, capitalize, getRuntimeBusinessProfile } from "./business-runtime";
import { demoRestaurantContext, type RestaurantVoiceContext } from "./restaurant-context";

export interface OpenAIRealtimeFunctionTool {
  description: string;
  name: string;
  parameters: Record<string, unknown>;
  type: "function";
}

export function buildOpenAIRealtimeTools(
  context: RestaurantVoiceContext = demoRestaurantContext,
  ownerContact?: TrustedContact,
): OpenAIRealtimeFunctionTool[] {
  if (ownerContact) return buildOwnerRealtimeTools();

  const profile = getRuntimeBusinessProfile(context);
  const lookupName = profile.isRestaurant ? "lookup_restaurant_context" : "lookup_business_context";
  const tools: OpenAIRealtimeFunctionTool[] = [
    {
      description: profile.isRestaurant
        ? "Look up restaurant facts, policies, FAQs, menu highlights, specials, hours, parking, reservations, pickup, payment, allergy, delivery, lost item, complaint, vendor, or human handoff details before answering."
        : `Look up ${profile.businessNoun} facts, policies, FAQs, ${profile.offeringNoun} highlights, service area, hours, ${profile.appointmentNoun}s, quote policy, payment, safety, complaint, vendor, or human handoff details before answering.`,
      name: lookupName,
      parameters: {
        additionalProperties: false,
        properties: {
          topic: {
            description: profile.isRestaurant
              ? "The restaurant topic the caller asked about, such as specials, hours, parking, reservations, pickup, payment, allergies, delivery drivers, lost item, complaint, vendor, or menu."
              : `The ${profile.businessNoun} topic the caller asked about, such as hours, service area, ${profile.offeringNoun}, ${profile.appointmentNoun}s, quotes, payment, safety, complaints, vendors, or staff callback.`,
            type: "string",
          },
        },
        required: ["topic"],
        type: "object",
      },
      type: "function",
    },
    {
      description:
        "Send a caller-approved SMS confirmation or helpful follow-up text. Use only after the caller agrees to receive a text or explicitly asks for one.",
      name: "send_guest_confirmation",
      parameters: {
        additionalProperties: false,
        properties: {
          guest_name: {
            description: `${capitalize(profile.customerNoun)}, guest, order, or request name, if known.`,
            type: "string",
          },
          kind: {
            description: "The type of text to send.",
            enum: ["appointment", "order", "quote", "request", "reservation", "note"],
            type: "string",
          },
          message: {
            description: "Short helpful message for note texts. Do not include sensitive information.",
            type: "string",
          },
          formatted_address: {
            description: "Validated or caller-confirmed service/customer address to include in a request summary text.",
            type: "string",
          },
          order_items: {
            description: "Pickup order items when sending an order confirmation.",
            items: {
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                price_cents: { type: "number" },
                quantity: { type: "number" },
              },
              required: ["name", "quantity"],
              type: "object",
            },
            type: "array",
          },
          party_size: {
            description: "Party size for reservation texts.",
            type: "number",
          },
          phone_number: {
            description: "Caller mobile number. Omit this to use SIP caller ID when available.",
            type: "string",
          },
          reservation_date: {
            description: profile.isRestaurant
              ? "Reservation date in the restaurant's local context, preferably YYYY-MM-DD."
              : `${capitalize(profile.appointmentNoun)} or request date in the business's local context, preferably YYYY-MM-DD.`,
            type: "string",
          },
          reservation_time: {
            description: profile.isRestaurant
              ? "Reservation time, such as 6 PM or 18:00."
              : `${capitalize(profile.appointmentNoun)} or request time, such as 6 PM or 18:00.`,
            type: "string",
          },
        },
        required: ["kind"],
        type: "object",
      },
      type: "function",
    },
    {
      description:
        "Send a configured business link, such as online ordering, reservations, booking, menu, quote, or intake. Use after the caller asks for the link or agrees to receive it by text.",
      name: "send_business_link",
      parameters: {
        additionalProperties: false,
        properties: {
          link_kind: {
            description: "Which configured link to send.",
            enum: Object.keys(businessLinkKindLabels),
            type: "string",
          },
          phone_number: {
            description: "Caller mobile number. Omit this to use SIP caller ID when available.",
            type: "string",
          },
        },
        required: ["link_kind"],
        type: "object",
      },
      type: "function",
    },
    {
      description:
        "Validate, geolocate, and format a caller-provided service, job, delivery, or customer address before saving a request or sending a confirmation. Use this whenever the caller gives an address.",
      name: "normalize_customer_address",
      parameters: {
        additionalProperties: false,
        properties: {
          raw_address: {
            description: "The address or address fragment exactly as the caller gave it, including city/state if provided.",
            type: "string",
          },
          unit_or_access: {
            description: "Apartment, suite, unit, floor, gate code, business name, or access note if the caller provided one.",
            type: "string",
          },
        },
        required: ["raw_address"],
        type: "object",
      },
      type: "function",
    },
    {
      description:
        "Create a generic staff-facing customer request for leads, service appointments, quotes, order requests, reservation requests, callbacks, or other business workflows not handled by a specialized tool.",
      name: "create_customer_request",
      parameters: {
        additionalProperties: false,
        properties: {
          callback_phone: {
            description: "Best callback number. Omit to use SIP caller ID when available.",
            type: "string",
          },
          caller_name: {
            description: "Customer name, if known.",
            type: "string",
          },
          details: {
            additionalProperties: true,
            description: "Short structured details such as requested date, service area, issue, budget, or notes.",
            type: "object",
          },
          formatted_address: {
            description: "Google-formatted or read-back-confirmed service/customer address.",
            type: "string",
          },
          address_latitude: {
            description: "Latitude from address validation, if available.",
            type: "number",
          },
          address_longitude: {
            description: "Longitude from address validation, if available.",
            type: "number",
          },
          address_status: {
            description: "Address validation status returned by normalize_customer_address.",
            enum: ["validated", "likely_complete_unverified", "needs_more_detail", "not_found", "validation_unavailable"],
            type: "string",
          },
          google_maps_uri: {
            description: "Google Maps URI returned by address validation, if available.",
            type: "string",
          },
          google_place_id: {
            description: "Google place ID returned by address validation, if available.",
            type: "string",
          },
          request_type: {
            description: "The category of request.",
            enum: ["callback", "complaint", "general", "lead", "order", "quote", "reservation", "service_appointment"],
            type: "string",
          },
          summary: {
            description: "One concise staff-facing sentence summarizing what the customer needs.",
            type: "string",
          },
          urgency: {
            description: "How urgent this request is.",
            enum: ["low", "normal", "high", "urgent"],
            type: "string",
          },
        },
        required: ["request_type", "summary"],
        type: "object",
      },
      type: "function",
    },
    {
      description:
        "Save a restaurant reservation request after collecting date, time, party size, and guest name. In the current pilot this creates a staff-confirmed request rather than guaranteeing a live table.",
      name: "create_reservation_request",
      parameters: {
        additionalProperties: false,
        properties: {
          guest_name: {
            description: "Real guest name for the reservation. Never use no, none, that's all, I'm good, goodbye, or refusal phrases as the name.",
            type: "string",
          },
          notes: {
            description: "Special occasion, seating preference, accessibility need, or other short notes.",
            type: "string",
          },
          party_size: {
            description: "Number of guests.",
            type: "number",
          },
          phone_number: {
            description: "Caller phone number. Omit this to use SIP caller ID when available.",
            type: "string",
          },
          reservation_date: {
            description: "Reservation date in the restaurant's local calendar, preferably YYYY-MM-DD.",
            type: "string",
          },
          reservation_time: {
            description: "Reservation time in 24-hour HH:mm format, such as 18:00.",
            type: "string",
          },
        },
        required: ["guest_name", "party_size", "reservation_date", "reservation_time"],
        type: "object",
      },
      type: "function",
    },
    {
      description:
        "Create a staff callback request for severe allergies, unknown answers, complaints, human requests, unusual substitutions, unavailable items, or any situation staff must confirm. This does not transfer the live call.",
      name: "request_staff_callback",
      parameters: {
        additionalProperties: false,
        properties: {
          callback_phone: {
            description: "Best callback number. Omit to use SIP caller ID when available.",
            type: "string",
          },
          caller_name: {
            description: "Caller name, if known.",
            type: "string",
          },
          kind: {
            description: "Reason category for staff routing.",
            enum: ["allergy", "complaint", "delivery_failure", "handoff", "low_confidence", "order", "reservation", "sales"],
            type: "string",
          },
          question: {
            description: "The exact question staff needs to answer, if this is an unknown-answer callback.",
            type: "string",
          },
          reason: {
            description: "Short staff-facing reason for the callback.",
            type: "string",
          },
          urgency: {
            description: "How urgent this feels.",
            enum: ["low", "medium", "high"],
            type: "string",
          },
        },
        required: ["kind", "reason"],
        type: "object",
      },
      type: "function",
    },
    {
      description:
        "Finish the live call only after the caller clearly says they are done, says no to the anything-else question, or says goodbye. This lets the service close the phone session after one final goodbye.",
      name: "finish_call",
      parameters: {
        additionalProperties: false,
        properties: {
          closing_line: {
            description: "Short final sentence to say to the caller before the call ends.",
            type: "string",
          },
          reason: {
            description: "Why the call is ready to end.",
            enum: ["caller_done", "caller_goodbye", "wrong_number_complete", "silent_or_abandoned"],
            type: "string",
          },
        },
        required: ["reason"],
        type: "object",
      },
      type: "function",
    },
  ];
  return profile.isRestaurant ? tools : tools.filter((tool) => tool.name !== "create_reservation_request");
}

export function buildOpenAIRealtimeTranscriptionPrompt(context: RestaurantVoiceContext) {
  return buildBusinessTranscriptionPrompt(context);
}

function buildOwnerRealtimeTools(): OpenAIRealtimeFunctionTool[] {
  return [
    {
      description:
        "Run a trusted owner or manager command. Use for reports, urgent calls, follow-ups, live business updates, business modes, and permanent knowledge updates. Pass the owner's exact latest request.",
      name: "run_owner_command",
      parameters: {
        additionalProperties: false,
        properties: {
          message: {
            description: "The owner or manager's exact latest request, such as 'what happened today' or 'remember that the bathroom is white'.",
            type: "string",
          },
        },
        required: ["message"],
        type: "object",
      },
      type: "function",
    },
    {
      description:
        "Finish the internal owner call only after the owner clearly says they are done, says no to the anything-else question, or says goodbye.",
      name: "finish_call",
      parameters: {
        additionalProperties: false,
        properties: {
          closing_line: {
            description: "Short final sentence to say to the owner before the call ends.",
            type: "string",
          },
          reason: {
            description: "Why the call is ready to end.",
            enum: ["caller_done", "caller_goodbye", "wrong_number_complete", "silent_or_abandoned"],
            type: "string",
          },
        },
        required: ["reason"],
        type: "object",
      },
      type: "function",
    },
  ];
}
