import { describe, expect, it } from "vitest";
import { defaultRestaurantAgentConfig } from "@/domain/restaurant-config";
import { sampleOnboardingDraft } from "@/domain/onboarding";
import {
  buildAgentConfigPayload,
  buildAlertRoutingConfigPayload,
  buildCallFeedbackInsertPayload,
  buildIngestionJobInsertPayload,
  buildMenuCategoryInsertRows,
  buildMenuItemInsertRows,
  buildMenuSourceInsertPayload,
  buildOnboardingProfilePayload,
  buildOrderDeliveryAttemptPayload,
  buildStaffTaskInsertPayload,
  buildReservationInsertPayload,
  calculateForwardingStatus,
  mapSupabaseCalls,
  mapSupabaseCallFeedback,
  mapSupabaseAgentConfig,
  mapSupabaseIngestionJob,
  mapSupabaseMenu,
  mapSupabaseMenuSource,
  mapSupabaseOrders,
  mapSupabasePhoneNumber,
  mapSupabaseReservations,
  mapSupabaseStaffAlertEvent,
  mapSupabaseStaffTask,
} from "./supabase-rest";
import { defaultAlertRoutingConfig } from "@/domain/alert-routing";

describe("Supabase call mapping", () => {
  it("maps persisted calls and transcript turns into dashboard call records", () => {
    const calls = mapSupabaseCalls(
      [
        {
          caller_name: null,
          caller_phone: "+15551234567",
          confidence: null,
          duration_seconds: 42,
          id: "call_1",
          intent: "faq",
          outcome: "unknown",
          recording_url: "https://api.twilio.com/recording.mp3",
          started_at: "2026-05-04T20:00:00.000Z",
          status: "new",
          summary: null,
        },
      ],
      [
        {
          call_id: "call_1",
          offset_seconds: 2.4,
          speaker: "caller",
          text: "What time do you close?",
        },
        {
          call_id: "call_1",
          offset_seconds: 4.1,
          speaker: "agent",
          text: "We close at 10 tonight.",
        },
      ],
      {
        orderLinks: [{ id: "order_1", source_call_id: "call_1" }],
        reservationLinks: [{ id: "reservation_1", source_call_id: "call_1" }],
      },
    );

    expect(calls[0]).toMatchObject({
      caller: "Unknown",
      confidence: 0,
      duration: 42,
      intent: "faq",
      orderId: "order_1",
      outcome: "unknown",
      phone: "+15551234567",
      reservationId: "reservation_1",
      recordingUrl: "https://api.twilio.com/recording.mp3",
      status: "new",
    });
    expect(calls[0].transcript).toEqual([
      { speaker: "caller", t: "00:02", text: "What time do you close?" },
      { speaker: "agent", t: "00:04", text: "We close at 10 tonight." },
    ]);
  });

  it("normalizes unexpected enum values", () => {
    const calls = mapSupabaseCalls(
      [
        {
          caller_name: "Sam",
          caller_phone: null,
          confidence: 12,
          duration_seconds: null,
          id: "call_2",
          intent: "weird",
          outcome: "also_weird",
          recording_url: null,
          started_at: "2026-05-04T20:00:00.000Z",
          status: "strange",
          summary: "Imported from provider",
        },
      ],
      [],
    );

    expect(calls[0].intent).toBe("other");
    expect(calls[0].outcome).toBe("unknown");
    expect(calls[0].status).toBe("new");
  });
});

describe("Supabase call feedback", () => {
  it("builds call feedback payloads for tuning Vera", () => {
    expect(
      buildCallFeedbackInsertPayload(
        {
          addToKnowledge: true,
          callId: "call_1",
          category: "missing_knowledge",
          note: "Caller asked about patio heaters.",
          suggestedAnswer: "Yes, the patio has heaters on chilly nights.",
        },
        "location_1",
      ),
    ).toEqual({
      add_to_knowledge: true,
      call_id: "call_1",
      category: "missing_knowledge",
      location_id: "location_1",
      note: "Caller asked about patio heaters.",
      suggested_answer: "Yes, the patio has heaters on chilly nights.",
    });
  });

  it("maps persisted call feedback back into review history", () => {
    expect(
      mapSupabaseCallFeedback({
        add_to_knowledge: true,
        call_id: "call_1",
        category: "awkward",
        created_at: "2026-05-11T20:00:00.000Z",
        created_by: "user_1",
        id: "feedback_1",
        note: " Too stiff. ",
        suggested_answer: "Say it more naturally.",
      }),
    ).toEqual({
      addedToKnowledge: true,
      callId: "call_1",
      category: "awkward",
      createdAt: "2026-05-11T20:00:00.000Z",
      createdBy: "user_1",
      id: "feedback_1",
      note: "Too stiff.",
      suggestedAnswer: "Say it more naturally.",
    });
  });
});

describe("Supabase agent config mapping", () => {
  it("builds persisted agent-config payloads from dashboard settings", () => {
    const payload = buildAgentConfigPayload(
      {
        ...defaultRestaurantAgentConfig,
        hostName: "Mina",
        orders: {
          ...defaultRestaurantAgentConfig.orders,
          destinations: ["staff_review", "printer"],
          enabled: false,
        },
      },
      "location_1",
    );

    expect(payload).toMatchObject({
      answer_after_rings: 3,
      greeting_template: defaultRestaurantAgentConfig.greetingTemplate,
      host_name: "Mina",
      location_id: "location_1",
      order_destinations: ["staff_review", "printer"],
      orders_enabled: false,
      payment_mode: "pay_at_pickup",
      reservation_provider: "opentable",
    });
    expect(new Date(payload.updated_at).toString()).not.toBe("Invalid Date");
  });

  it("maps persisted agent-config rows back into dashboard settings", () => {
    const mapped = mapSupabaseAgentConfig(
      {
        after_hours_behavior: "full_service",
        answer_after_rings: 4,
        answer_faqs_enabled: false,
        call_handling_mode: "answer_immediately",
        disclosure_enabled: false,
        escalation_phone_number: "+15550199",
        greeting_template: "Hello from Mina.",
        host_name: "Mina",
        id: "agent_1",
        order_destinations: ["printer"],
        orders_enabled: false,
        payment_mode: "pay_at_pickup",
        reservations_enabled: true,
        reservation_mode: "manual_request",
        reservation_provider: "resy",
        sms_confirmations_enabled: false,
        staff_escalation_enabled: true,
        tone: "professional",
        updated_at: "2026-05-05T20:00:00.000Z",
      },
      defaultRestaurantAgentConfig,
    );

    expect(mapped).toMatchObject({
      afterHoursBehavior: "full_service",
      answerAfterRings: 4,
      callHandlingMode: "answer_immediately",
      disclosureEnabled: false,
      escalationPhoneNumber: "+15550199",
      greetingTemplate: "Hello from Mina.",
      hostName: "Mina",
      tone: "professional",
    });
    expect(mapped.capabilities).toMatchObject({
      answerFaqs: false,
      handleReservations: true,
      sendSmsConfirmations: false,
      takeOrders: false,
    });
    expect(mapped.orders.destinations).toEqual(["printer"]);
    expect(mapped.orders.enabled).toBe(false);
    expect(mapped.reservations).toMatchObject({
      mode: "manual_request",
      provider: "resy",
    });
  });
});

describe("Supabase alert routing payloads", () => {
  it("builds alert-routing config payloads for Supabase persistence", () => {
    const payload = buildAlertRoutingConfigPayload(defaultAlertRoutingConfig, "location_1");

    expect(payload).toMatchObject({
      location_id: "location_1",
    });
    expect(payload.config.routes.complaint.enabled).toBe(true);
    expect(payload.config.routes.order.recipients.length).toBeGreaterThan(0);
    expect(new Date(payload.updated_at).toString()).not.toBe("Invalid Date");
    expect(payload.config.updatedAt).toBe(payload.updated_at);
  });
});

describe("Supabase staff alert event mapping", () => {
  it("maps persisted alert events into dashboard records", () => {
    const event = mapSupabaseStaffAlertEvent({
      call_id: "call_1",
      caller_phone: "+15550100",
      channels: ["sms", "email/webhook"],
      created_at: "2026-05-06T14:00:00.000Z",
      error_message: null,
      id: "alert_1",
      kind: "complaint",
      message: "Complaint alert - Olive & Ember",
      recipients: [
        { channel: "both", email: "gm@example.com", id: "gm", name: "GM", phone: "+15550200" },
      ],
      route_snapshot: {
        emailRecipientCount: 1,
        fallbackUsed: false,
        smsRecipientCount: 1,
      },
      sent_at: "2026-05-06T14:00:01.000Z",
      severity: "high",
      status: "sent",
      summary: "Complaint or refund risk detected.",
    });

    expect(event).toMatchObject({
      callId: "call_1",
      channels: ["sms", "email/webhook"],
      emailRecipientCount: 1,
      fallbackUsed: false,
      id: "alert_1",
      kind: "complaint",
      severity: "high",
      smsRecipientCount: 1,
      status: "sent",
    });
    expect(event.recipients[0]).toMatchObject({ channel: "both", name: "GM" });
  });
});

describe("Supabase staff task mapping", () => {
  it("maps persisted staff tasks into dashboard records", () => {
    const task = mapSupabaseStaffTask({
      assigned_to: "Maria",
      body: "Printer did not acknowledge the order.",
      call_id: "call_1",
      completed_at: null,
      created_at: "2026-05-06T14:00:00.000Z",
      due_at: "2026-05-06T14:15:00.000Z",
      id: "task_1",
      order_id: "order_1",
      priority: "urgent",
      reservation_id: null,
      status: "in_progress",
      task_type: "delivery_issue",
      title: "Fix failed printer alert",
    });

    expect(task).toEqual({
      assignedTo: "Maria",
      body: "Printer did not acknowledge the order.",
      callId: "call_1",
      completedAt: undefined,
      createdAt: "2026-05-06T14:00:00.000Z",
      dueAt: "2026-05-06T14:15:00.000Z",
      id: "task_1",
      orderId: "order_1",
      priority: "urgent",
      reservationId: undefined,
      status: "in_progress",
      title: "Fix failed printer alert",
      type: "delivery_issue",
    });
  });

  it("builds staff task insert payloads", () => {
    const payload = buildStaffTaskInsertPayload(
      {
        body: " Guest wants a manager callback. ",
        callId: "call_1",
        priority: "high",
        title: " Call guest ",
        type: "manager_callback",
      },
      "location_1",
    );

    expect(payload).toMatchObject({
      body: "Guest wants a manager callback.",
      call_id: "call_1",
      location_id: "location_1",
      priority: "high",
      status: "open",
      task_type: "manager_callback",
      title: "Call guest",
    });
  });
});

describe("Supabase order mapping", () => {
  it("maps persisted orders and items into dashboard order records", () => {
    const orders = mapSupabaseOrders(
      [
        {
          created_at: "2026-05-04T20:15:00.000Z",
          customer_name: "Sarah Chen",
          customer_phone: "+15551234567",
          destination: "staff_review",
          eta_minutes: 25,
          id: "order_1",
          notes: "Pickup at counter",
          payment_mode: "pay_at_pickup",
          source_call_id: "call_1",
          status: "accepted",
          total_cents: 5300,
        },
      ],
      [
        {
          modifiers: ["Light cheese"],
          name: "Margherita Pizza",
          notes: null,
          order_id: "order_1",
          price_cents: 1800,
          quantity: 1,
        },
        {
          modifiers: [],
          name: "Caesar Salad",
          notes: "Dressing on side",
          order_id: "order_1",
          price_cents: 1400,
          quantity: 1,
        },
      ],
      [
        {
          created_at: "2026-05-04T20:16:00.000Z",
          delivered_at: "2026-05-04T20:16:05.000Z",
          destination: "printer",
          error_message: null,
          id: "attempt_1",
          order_id: "order_1",
          status: "sent",
        },
      ],
    );

    expect(orders[0]).toMatchObject({
      customer: "Sarah Chen",
      deliveryAttempts: [
        {
          destination: "printer",
          id: "attempt_1",
          status: "sent",
        },
      ],
      destination: "staff_review",
      etaMinutes: 25,
      payAtPickup: true,
      phone: "+15551234567",
      sourceCallId: "call_1",
      status: "accepted",
      total: 53,
    });
    expect(orders[0].items).toEqual([
      { modifiers: ["Light cheese"], name: "Margherita Pizza", notes: undefined, price: 18, qty: 1 },
      { modifiers: undefined, name: "Caesar Salad", notes: "Dressing on side", price: 14, qty: 1 },
    ]);
  });

  it("normalizes unexpected order status values", () => {
    const orders = mapSupabaseOrders(
      [
        {
          created_at: "2026-05-04T20:15:00.000Z",
          customer_name: null,
          customer_phone: null,
          destination: null,
          eta_minutes: null,
          id: "order_2",
          notes: null,
          payment_mode: null,
          source_call_id: null,
          status: "mystery",
          total_cents: null,
        },
      ],
      [],
    );

    expect(orders[0].customer).toBe("Unknown");
    expect(orders[0].status).toBe("new");
    expect(orders[0].total).toBe(0);
  });

  it("builds delivery-attempt payloads for dashboard handoff actions", () => {
    const payload = buildOrderDeliveryAttemptPayload({
      destination: "printer",
      orderId: "order_1",
      payload: { source: "dashboard" },
      status: "sent",
    });

    expect(payload).toMatchObject({
      destination: "printer",
      error_message: null,
      order_id: "order_1",
      payload: { source: "dashboard" },
      status: "sent",
    });
    expect(new Date(payload.delivered_at ?? "").toString()).not.toBe("Invalid Date");
  });
});

describe("Supabase onboarding profile payload", () => {
  it("stores the draft with launch-readiness metadata", () => {
    const payload = buildOnboardingProfilePayload(sampleOnboardingDraft, "location_1");

    expect(payload).toMatchObject({
      draft: sampleOnboardingDraft,
      location_id: "location_1",
      status: "ready_for_test_call",
    });
    expect(payload.completed_required).toBe(payload.total_required);
    expect(payload.progress_percent).toBe(100);
    expect(new Date(payload.updated_at).toString()).not.toBe("Invalid Date");
  });
});

describe("Supabase phone number mapping", () => {
  it("maps persisted Twilio phone-number rows into dashboard records", () => {
    const phoneNumber = mapSupabasePhoneNumber({
      forwarding_mode: "forward_unanswered",
      forwarding_status: "pending_verification",
      id: "pn_1",
      last_verified_at: null,
      phone_number: "+14155550199",
      provider: "twilio",
      provider_sid: "PN123",
      restaurant_main_line: "+14155550148",
        status: "in-use",
        updated_at: "2026-05-05T14:00:00.000Z",
        verification_results: {
          busyForwarding: "failed",
          directCall: "passed",
          noAnswerForwarding: "passed",
          updatedAt: "2026-05-05T14:01:00.000Z",
        },
        voice_webhook_url: "https://voice.hostline.test/twilio/voice",
      });

    expect(phoneNumber).toEqual({
      forwardingMode: "forward_unanswered",
      forwardingStatus: "pending_verification",
      forwardingVerification: {
        busyForwarding: "failed",
        directCall: "passed",
        noAnswerForwarding: "passed",
        notes: undefined,
        updatedAt: "2026-05-05T14:01:00.000Z",
      },
      id: "pn_1",
      lastVerifiedAt: undefined,
      phoneNumber: "+14155550199",
      provider: "twilio",
      providerSid: "PN123",
      restaurantMainLine: "+14155550148",
      status: "in-use",
      updatedAt: "2026-05-05T14:00:00.000Z",
      voiceWebhookUrl: "https://voice.hostline.test/twilio/voice",
    });
  });

  it("calculates forwarding verification status", () => {
    expect(
      calculateForwardingStatus({
        busyForwarding: "passed",
        directCall: "passed",
        noAnswerForwarding: "passed",
      }),
    ).toBe("verified");
    expect(calculateForwardingStatus({ directCall: "passed" })).toBe("partial");
    expect(calculateForwardingStatus({ busyForwarding: "failed", directCall: "passed" })).toBe("needs_attention");
    expect(calculateForwardingStatus({})).toBe("not_verified");
  });
});

describe("Supabase menu mapping", () => {
  it("groups persisted menu items into dashboard categories", () => {
    const menu = mapSupabaseMenu(
      [
        { id: "cat_pizza", name: "Pizza", sort_order: 2 },
        { id: "cat_starters", name: "Starters", sort_order: 1 },
      ],
      [
        {
          available: true,
          category_id: "cat_pizza",
          description: "Tomato, mozzarella, basil",
          id: "item_1",
          modifiers: ["Light cheese"],
          name: "Margherita",
          prep_minutes: 11,
          price_cents: 1800,
          upsell_suggestions: ["Add truffle oil +$3"],
        },
        {
          available: null,
          category_id: "cat_starters",
          description: null,
          id: "item_2",
          modifiers: [],
          name: "Burrata",
          prep_minutes: null,
          price_cents: 1600,
          upsell_suggestions: [],
        },
      ],
    );

    expect(menu.map((category) => category.name)).toEqual(["Starters", "Pizza"]);
    expect(menu[0].items[0]).toEqual({
      available: true,
      description: undefined,
      id: "item_2",
      modifiers: undefined,
      name: "Burrata",
      prepMinutes: 10,
      price: 16,
      upsell: undefined,
    });
    expect(menu[1].items[0]).toMatchObject({
      description: "Tomato, mozzarella, basil",
      modifiers: ["Light cheese"],
      name: "Margherita",
      prepMinutes: 11,
      price: 18,
      upsell: ["Add truffle oil +$3"],
    });
  });

  it("builds menu insert rows from parsed categories", () => {
    const parsedCategories = [
      {
        items: [
          {
            available: true,
            description: "Fresh tomato",
            modifiers: ["No basil"],
            name: "Margherita",
            prepMinutes: 10,
            priceCents: 1800,
          },
        ],
        name: "Pizza",
      },
    ];

    expect(buildMenuCategoryInsertRows(parsedCategories, "location_1")).toEqual([
      {
        location_id: "location_1",
        name: "Pizza",
        sort_order: 0,
      },
    ]);
    expect(buildMenuItemInsertRows(parsedCategories, [{ id: "cat_1" }])).toEqual([
      {
        available: true,
        category_id: "cat_1",
        description: "Fresh tomato",
        modifiers: ["No basil"],
        name: "Margherita",
        prep_minutes: 10,
        price_cents: 1800,
        upsell_suggestions: [],
      },
    ]);
  });
});

describe("Supabase menu source mapping", () => {
  it("builds source and job payloads for queued menu URL ingestion", () => {
    const sourcePayload = buildMenuSourceInsertPayload(
      {
        frequency: "daily",
        url: " https://www.saffrontable.com/menu ",
      },
      "location_1",
    );

    expect(sourcePayload).toMatchObject({
      label: "saffrontable.com",
      location_id: "location_1",
      source_type: "url",
      status: "pending",
      sync_frequency: "daily",
      url: "https://www.saffrontable.com/menu",
    });

    const jobPayload = buildIngestionJobInsertPayload({
      jobType: "menu_source_sync",
      locationId: "location_1",
      source: {
        file_name: null,
        id: "source_1",
        label: "saffrontable.com",
        source_type: "url",
        sync_frequency: "daily",
        url: "https://www.saffrontable.com/menu",
      },
    });

    expect(jobPayload).toEqual({
      input: {
        fileName: null,
        frequency: "daily",
        label: "saffrontable.com",
        sourceType: "url",
        url: "https://www.saffrontable.com/menu",
      },
      job_type: "menu_source_sync",
      location_id: "location_1",
      result: {},
      source_id: "source_1",
      status: "queued",
    });
  });

  it("maps persisted menu sources and ingestion jobs into dashboard records", () => {
    const source = mapSupabaseMenuSource({
      created_at: "2026-05-05T20:00:00.000Z",
      file_name: null,
      id: "source_1",
      label: null,
      last_error: "Could not fetch URL",
      last_synced_at: null,
      source_type: "url",
      status: "error",
      sync_frequency: "hourly",
      updated_at: "2026-05-05T20:15:00.000Z",
      url: "https://www.saffrontable.com/menu",
    });

    expect(source).toEqual({
      fileName: undefined,
      frequency: "hourly",
      id: "source_1",
      label: "saffrontable.com",
      lastError: "Could not fetch URL",
      lastSyncedAt: "Never",
      status: "error",
      type: "url",
      url: "https://www.saffrontable.com/menu",
    });

    const job = mapSupabaseIngestionJob({
      completed_at: null,
      created_at: "2026-05-05T20:16:00.000Z",
      error_message: null,
      id: "job_1",
      job_type: "menu_source_sync",
      result: { summary: "Found 24 items" },
      source_id: "source_1",
      status: "queued",
    });

    expect(job).toEqual({
      completedAt: undefined,
      createdAt: "2026-05-05T20:16:00.000Z",
      errorMessage: undefined,
      id: "job_1",
      sourceId: "source_1",
      status: "queued",
      summary: "Found 24 items",
      type: "menu_source_sync",
    });
  });
});

describe("Supabase reservation mapping", () => {
  it("maps persisted reservations into dashboard records", () => {
    const reservations = mapSupabaseReservations([
      {
        created_at: "2026-05-05T19:00:00.000Z",
        guest_name: "Nina Rossi",
        guest_phone: "+15550102",
        id: "res_1",
        manual_request: true,
        notes: "Anniversary",
        party_size: 6,
        provider: "opentable",
        provider_reservation_id: null,
        reservation_date: "2026-05-10",
        reservation_time: "19:30:00",
        source: "ai_host",
        source_call_id: "call_1",
        status: "pending",
      },
    ]);

    expect(reservations[0]).toEqual({
      createdAt: "2026-05-05T19:00:00.000Z",
      date: "2026-05-10",
      guest: "Nina Rossi",
      id: "res_1",
      manual: true,
      notes: "Anniversary",
      partySize: 6,
      phone: "+15550102",
      provider: "opentable",
      providerReservationId: undefined,
      source: "ai_host",
      sourceCallId: "call_1",
      status: "pending",
      time: "19:30",
    });
  });

  it("normalizes unexpected reservation fields", () => {
    const reservations = mapSupabaseReservations([
      {
        created_at: null,
        guest_name: null,
        guest_phone: null,
        id: "res_2",
        manual_request: null,
        notes: null,
        party_size: null,
        provider: null,
        provider_reservation_id: null,
        reservation_date: null,
        reservation_time: null,
        source: "bad_source",
        source_call_id: null,
        status: "bad_status",
      },
    ]);

    expect(reservations[0]).toMatchObject({
      date: "",
      guest: "Unknown",
      manual: false,
      partySize: 0,
      phone: "Unknown",
      source: "ai_host",
      status: "pending",
      time: "",
    });
  });

  it("builds insert payloads for staff-confirmed manual requests", () => {
    expect(
      buildReservationInsertPayload(
        {
          date: "2026-05-10",
          guest: " Nina Rossi ",
          notes: " Birthday table ",
          partySize: 6,
          phone: " +15550102 ",
          provider: "opentable",
          source: "ai_host",
          status: "pending",
          time: "19:30",
        },
        "location_1",
      ),
    ).toEqual({
      guest_name: "Nina Rossi",
      guest_phone: "+15550102",
      location_id: "location_1",
      manual_request: true,
      notes: "Birthday table",
      party_size: 6,
      provider: "opentable",
      reservation_date: "2026-05-10",
      reservation_time: "19:30:00",
      source: "ai_host",
      status: "pending",
    });
  });
});
