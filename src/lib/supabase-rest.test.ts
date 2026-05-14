import { describe, expect, it } from "vitest";
import { defaultRestaurantAgentConfig } from "@/domain/restaurant-config";
import { sampleOnboardingDraft } from "@/domain/onboarding";
import {
  buildAgentConfigPayload,
  buildAlertRoutingConfigPayload,
  buildCallFeedbackInsertPayload,
  buildBusinessLiveUpdateInsertPayload,
  buildIngestionJobInsertPayload,
  buildKnowledgeSectionUpdatePayload,
  buildKnowledgeSuggestionInsertPayload,
  buildKnowledgeSuggestionUpdatePayload,
  buildMenuCategoryInsertRows,
  buildMenuItemInsertRows,
  buildMenuSourceInsertPayload,
  buildOnboardingProfilePayload,
  buildOrderDeliveryAttemptPayload,
  buildStaffTaskInsertPayload,
  buildTrustedContactInsertPayload,
  buildTrustedContactUpdatePayload,
  buildReservationInsertPayload,
  calculateForwardingStatus,
  mapSupabaseCalls,
  mapSupabaseCallFeedback,
  mapSupabaseBusinessLiveState,
  mapSupabaseBusinessLiveUpdate,
  mapSupabaseAgentConfig,
  mapSupabaseIngestionJob,
  mapSupabaseKnowledgeSection,
  mapSupabaseKnowledgeSuggestion,
  mapSupabaseMenu,
  mapSupabaseMenuSource,
  mapSupabaseOrders,
  mapSupabaseOwnerCommandActivity,
  mapSupabasePhoneNumber,
  mapSupabaseReservations,
  mapSupabaseStaffAlertEvent,
  mapSupabaseStaffTask,
  mapSupabaseTenantDirectory,
  mapSupabaseTrustedContact,
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
          location_id: "location_1",
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
      locationId: "location_1",
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
          location_id: null,
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

  it("labels website chats from persisted provider metadata", () => {
    const calls = mapSupabaseCalls(
      [
        {
          caller_name: null,
          caller_phone: null,
          confidence: 76,
          duration_seconds: 18,
          external_call_sid: "webchat_visitor_123",
          id: "chat_1",
          intent: "faq",
          location_id: "location_1",
          outcome: "resolved",
          recording_url: null,
          started_at: "2026-05-04T20:00:00.000Z",
          status: "resolved",
          summary: "Visitor asked about parking.",
          twilio_payload: { provider: "web_chat" },
        },
      ],
      [],
    );

    expect(calls[0]).toMatchObject({
      caller: "Website visitor",
      channel: "web_chat",
      phone: "Website chat",
    });
  });

  it("preserves complaint and sales call intents for operations reporting", () => {
    const calls = mapSupabaseCalls(
      [
        {
          caller_name: "Upset Guest",
          caller_phone: "+15550100",
          confidence: 87,
          duration_seconds: 90,
          id: "call_complaint",
          intent: "complaint",
          location_id: "location_1",
          outcome: "manager_alerted",
          recording_url: null,
          started_at: "2026-05-04T20:00:00.000Z",
          status: "needs_review",
          summary: "Guest reported a missing item.",
        },
        {
          caller_name: "Vendor",
          caller_phone: "+15550101",
          confidence: 74,
          duration_seconds: 32,
          id: "call_sales",
          intent: "sales",
          location_id: "location_1",
          outcome: "message_taken",
          recording_url: null,
          started_at: "2026-05-04T20:01:00.000Z",
          status: "new",
          summary: "Vendor asked for purchasing contact.",
        },
      ],
      [],
    );

    expect(calls.map((call) => call.intent)).toEqual(["complaint", "sales"]);
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

describe("Supabase knowledge sections", () => {
  it("builds and maps owner-approved knowledge suggestions", () => {
    expect(
      buildKnowledgeSuggestionInsertPayload(
        {
          body: "Observed issue: Vera did not know patio heater policy.\n\nApproved answer or behavior: Patio heaters are available on chilly nights.",
          callId: "call_1",
          feedbackId: "feedback_1",
          priority: "high",
          source: "call_feedback",
          suggestedAnswer: "Patio heaters are available on chilly nights.",
          title: "Patio heater policy",
        },
        "location_1",
      ),
    ).toEqual({
      body: "Observed issue: Vera did not know patio heater policy.\n\nApproved answer or behavior: Patio heaters are available on chilly nights.",
      call_id: "call_1",
      feedback_id: "feedback_1",
      location_id: "location_1",
      priority: "high",
      source: "call_feedback",
      source_question: null,
      status: "pending",
      suggested_answer: "Patio heaters are available on chilly nights.",
      title: "Patio heater policy",
    });

    expect(
      buildKnowledgeSuggestionUpdatePayload({
        id: "suggestion_1",
        status: "rejected",
      }),
    ).toMatchObject({
      reviewed_at: expect.any(String),
      status: "rejected",
    });

    expect(
      mapSupabaseKnowledgeSuggestion({
        applied_knowledge_section_id: null,
        body: " Use this answer. ",
        call_id: "call_1",
        created_at: "2026-05-13T20:00:00.000Z",
        feedback_id: "feedback_1",
        id: "suggestion_1",
        location_id: "location_1",
        priority: "urgent",
        reviewed_at: null,
        source: "call_feedback",
        source_question: "Do you have patio heaters?",
        status: "pending",
        suggested_answer: "Yes.",
        title: " Patio heaters ",
      }),
    ).toMatchObject({
      body: "Use this answer.",
      priority: "urgent",
      source: "call_feedback",
      status: "pending",
      title: "Patio heaters",
    });
  });

  it("maps call tuning notes separately from normal knowledge", () => {
    expect(
      mapSupabaseKnowledgeSection({
        body: "Feedback: Caller asked about specials.\n\nPreferred answer: Answer specials directly.\n\nSource call: call_1",
        id: "section_1",
        is_active: true,
        location_id: "location_1",
        title: "Call tuning - Wrong answer",
        updated_at: "2026-05-12T20:00:00.000Z",
      }),
    ).toEqual({
      body: "Feedback: Caller asked about specials.\n\nPreferred answer: Answer specials directly.\n\nSource call: call_1",
      id: "section_1",
      isActive: true,
      isBehaviorTuning: true,
      locationId: "location_1",
      title: "Call tuning - Wrong answer",
      updatedAt: "2026-05-12T20:00:00.000Z",
    });

    expect(
      mapSupabaseKnowledgeSection({
        body: "Metered street parking is available nearby.",
        id: "section_2",
        is_active: true,
        location_id: "location_1",
        title: "Parking",
        updated_at: null,
      }).isBehaviorTuning,
    ).toBe(false);
  });

  it("builds knowledge section update payloads", () => {
    expect(
      buildKnowledgeSectionUpdatePayload({
        body: " Updated body. ",
        id: "section_1",
        isActive: false,
        title: " Updated title ",
      }),
    ).toMatchObject({
      body: "Updated body.",
      is_active: false,
      title: "Updated title",
    });
  });
});

describe("Supabase business live updates", () => {
  it("maps live settings and updates into shared business live state", () => {
    const state = mapSupabaseBusinessLiveState(
      {
        active_mode: "busy",
        location_id: "location_1",
        updated_at: "2026-05-13T20:00:00.000Z",
      },
      [
        {
          body: " Mention the lobster ravioli. ",
          cleared_at: null,
          created_at: "2026-05-13T19:55:00.000Z",
          expiration: "today_close",
          expires_at: "2026-05-13T23:59:59.999Z",
          id: "live_1",
          location_id: "location_1",
          mode: null,
          source: "owner_text",
          title: " Tonight's special ",
          update_type: "special",
        },
        {
          body: "Already cleared.",
          cleared_at: "2026-05-13T20:01:00.000Z",
          created_at: "2026-05-13T19:54:00.000Z",
          expiration: "today_close",
          expires_at: null,
          id: "live_2",
          location_id: "location_1",
          mode: null,
          source: "dashboard",
          title: "Cleared",
          update_type: "policy",
        },
      ],
    );

    expect(state.mode).toBe("busy");
    expect(state.updatedAt).toBe("2026-05-13T20:00:00.000Z");
    expect(state.updates).toEqual([
      {
        body: "Mention the lobster ravioli.",
        createdAt: "2026-05-13T19:55:00.000Z",
        expiration: "today_close",
        expiresAt: "2026-05-13T23:59:59.999Z",
        id: "live_1",
        mode: undefined,
        source: "owner_text",
        title: "Tonight's special",
        type: "special",
      },
    ]);
  });

  it("builds insert payloads and normalizes unexpected persisted values", () => {
    expect(
      buildBusinessLiveUpdateInsertPayload(
        {
          body: " We are closed tomorrow. ",
          createdAt: "2026-05-13T20:00:00.000Z",
          expiration: "tomorrow_close",
          expiresAt: "2026-05-14T23:59:59.999Z",
          id: "local_1",
          mode: "holiday",
          source: "owner_text",
          title: " Closed tomorrow ",
          type: "closure",
        },
        "location_1",
      ),
    ).toEqual({
      body: "We are closed tomorrow.",
      expiration: "tomorrow_close",
      expires_at: "2026-05-14T23:59:59.999Z",
      location_id: "location_1",
      mode: "holiday",
      source: "owner_text",
      title: "Closed tomorrow",
      update_type: "closure",
    });

    expect(
      mapSupabaseBusinessLiveUpdate({
        body: null,
        cleared_at: null,
        created_at: null,
        expiration: "weird",
        expires_at: null,
        id: "live_3",
        location_id: "location_1",
        mode: "not_a_mode",
        source: "unknown",
        title: null,
        update_type: "odd",
      }),
    ).toMatchObject({
      expiration: "today_close",
      mode: undefined,
      source: "dashboard",
      title: "Live update",
      type: "policy",
    });
  });
});

describe("Supabase owner command activity", () => {
  it("maps persisted owner email and text events into dashboard activity", () => {
    expect(
      mapSupabaseOwnerCommandActivity({
        body: "Tonight's special is lobster ravioli.",
        created_at: "2026-05-13T20:00:00.000Z",
        direction: "inbound",
        from_phone: "owner@example.com",
        id: "event_email",
        location_id: "location_1",
        provider: "email",
        provider_message_sid: "email_123",
        raw_payload: {},
        status: "owner_email_command",
        thread_id: null,
        to_phone: "updates@signalhost.ai",
      }),
    ).toEqual({
      body: "Tonight's special is lobster ravioli.",
      channel: "email",
      createdAt: "2026-05-13T20:00:00.000Z",
      direction: "inbound",
      id: "event_email",
      status: "owner_email_command",
      title: "Owner email command",
    });

    expect(
      mapSupabaseOwnerCommandActivity({
        body: "Got it. I saved that live update.",
        created_at: "2026-05-13T20:00:01.000Z",
        direction: "outbound",
        from_phone: "+15550000",
        id: "event_sms",
        location_id: "location_1",
        provider: "twilio",
        provider_message_sid: null,
        raw_payload: {},
        status: "owner_command_reply",
        thread_id: null,
        to_phone: "+14155550148",
      }),
    ).toMatchObject({
      channel: "sms",
      direction: "outbound",
      title: "SignalHost text reply",
    });

    expect(
      mapSupabaseOwnerCommandActivity({
        body: "Any urgent calls today?",
        created_at: "2026-05-13T20:00:02.000Z",
        direction: "inbound",
        from_phone: "signalhost-dashboard",
        id: "event_dashboard",
        location_id: "location_1",
        provider: "dashboard",
        provider_message_sid: null,
        raw_payload: {},
        status: "owner_dashboard_command",
        thread_id: null,
        to_phone: "signalhost",
      }),
    ).toMatchObject({
      channel: "dashboard",
      direction: "inbound",
      title: "Dashboard command",
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
      location_id: "location_1",
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
      locationId: "location_1",
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

describe("Supabase trusted contacts", () => {
  it("builds insert and update payloads for trusted owner command contacts", () => {
    expect(
      buildTrustedContactInsertPayload(
        {
          contactType: "manager",
          email: "Jill@Example.com",
          name: "Jill Manager",
          phone: "(781) 307-2672",
          preferredChannel: "both",
        },
        "location_1",
      ),
    ).toMatchObject({
      can_add_live_updates: true,
      can_approve_permanent_knowledge: false,
      can_receive_alerts: true,
      can_resolve_customer_requests: true,
      can_use_owner_assistant: true,
      contact_type: "manager",
      email: "jill@example.com",
      location_id: "location_1",
      name: "Jill Manager",
      phone: "+17813072672",
      preferred_channel: "both",
      requires_owner_approval: true,
    });

    expect(
      buildTrustedContactUpdatePayload({
        canApprovePermanentKnowledge: true,
        canManageAlertPreferences: true,
        requiresOwnerApproval: false,
      }),
    ).toMatchObject({
      can_approve_permanent_knowledge: true,
      can_manage_alert_preferences: true,
      requires_owner_approval: false,
    });
  });

  it("maps trusted contact rows with safe defaults", () => {
    expect(
      mapSupabaseTrustedContact({
        can_add_live_updates: null,
        can_approve_permanent_knowledge: null,
        can_manage_alert_preferences: null,
        can_receive_alerts: true,
        can_resolve_customer_requests: null,
        can_use_owner_assistant: true,
        contact_type: "owner",
        created_at: "2026-05-13T20:00:00.000Z",
        email: "owner@example.com",
        id: "contact_1",
        location_id: "location_1",
        name: "Owner",
        phone: "+17813072672",
        preferred_channel: "sms",
        requires_owner_approval: null,
        trusted_identity_enabled: true,
        updated_at: "2026-05-13T20:00:00.000Z",
      }),
    ).toMatchObject({
      canApprovePermanentKnowledge: true,
      canManageAlertPreferences: true,
      canUseOwnerAssistant: true,
      contactType: "owner",
      email: "owner@example.com",
      requiresOwnerApproval: false,
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
  it("keeps the profile in progress while the launch number is still a demo placeholder", () => {
    const payload = buildOnboardingProfilePayload(sampleOnboardingDraft, "location_1");

    expect(payload).toMatchObject({
      draft: sampleOnboardingDraft,
      location_id: "location_1",
      status: "in_progress",
    });
    expect(payload.completed_required).toBeLessThan(payload.total_required);
    expect(payload.progress_percent).toBeLessThan(100);
    expect(new Date(payload.updated_at).toString()).not.toBe("Invalid Date");
  });

  it("marks the profile ready after a real SignalHost number is assigned", () => {
    const readyDraft = {
      ...sampleOnboardingDraft,
      assignedSignalHostNumber: "+16175550199",
    };
    const payload = buildOnboardingProfilePayload(readyDraft, "location_1");

    expect(payload).toMatchObject({
      draft: readyDraft,
      location_id: "location_1",
      status: "ready_for_test_call",
    });
    expect(payload.completed_required).toBe(payload.total_required);
    expect(payload.progress_percent).toBe(100);
    expect(new Date(payload.updated_at).toString()).not.toBe("Invalid Date");
  });
});

describe("Supabase tenant directory mapping", () => {
  it("combines organizations, locations, onboarding, phone numbers, owners, and usage", () => {
    const rows = mapSupabaseTenantDirectory({
      locations: [{
        address: "Waltham, MA",
        ai_host_phone: "+17815550100",
        created_at: "2026-05-12T12:00:00.000Z",
        cuisine: "HVAC",
        id: "loc_1",
        name: "Summit Air",
        organization_id: "org_1",
        phone: "+17815550199",
        timezone: "America/New_York",
      }],
      memberships: [{
        created_at: "2026-05-12T11:59:00.000Z",
        member_email: "owner@summitair.test",
        member_name: "Owner Example",
        organization_id: "org_1",
        role: "owner",
      }],
      monthlyCalls: [
        { id: "call_1", location_id: "loc_1" },
        { id: "call_2", location_id: "loc_1" },
      ],
      onboardingProfiles: [{
        completed_required: 12,
        draft: {
          businessType: "hvac",
          selectedPlanIncludedInteractions: "800",
          selectedPlanMonthly: "249",
          selectedPlanName: "Growth",
        },
        location_id: "loc_1",
        progress_percent: 100,
        status: "ready_for_test_call",
        total_required: 12,
        updated_at: "2026-05-12T12:01:00.000Z",
      }],
      organizations: [{ created_at: "2026-05-12T11:58:00.000Z", id: "org_1", name: "Summit Air" }],
      phoneNumbers: [{
        forwarding_status: "pending_verification",
        location_id: "loc_1",
        phone_number: "+17815550100",
        status: "provisioned",
        voice_webhook_url: "https://voice.signalhost.ai/twilio/voice?locationId=loc_1",
      }],
    });

    expect(rows[0]).toMatchObject({
      aiHostPhone: "+17815550100",
      businessLabel: "HVAC",
      businessType: "hvac",
      callsThisMonth: 2,
      includedInteractions: 800,
      locationId: "loc_1",
      monthlyPrice: 249,
      onboardingProgressPercent: 100,
      ownerEmail: "owner@summitair.test",
      planName: "Growth",
      status: "healthy",
    });
  });

  it("surfaces incomplete tenant setup as attention or critical", () => {
    const rows = mapSupabaseTenantDirectory({
      locations: [],
      memberships: [],
      monthlyCalls: [],
      onboardingProfiles: [],
      organizations: [{ created_at: "2026-05-12T11:58:00.000Z", id: "org_1", name: "No Location Yet" }],
      phoneNumbers: [],
    });

    expect(rows[0]).toMatchObject({
      locationId: "not-created",
      onboardingStatus: "not_started",
      status: "attention",
    });
  });
});

describe("Supabase phone number mapping", () => {
  it("maps persisted Twilio phone-number rows into dashboard records", () => {
    const phoneNumber = mapSupabasePhoneNumber({
      created_at: "2026-05-05T13:59:00.000Z",
      forwarding_mode: "forward_unanswered",
      forwarding_status: "pending_verification",
      id: "pn_1",
      last_verified_at: null,
      phone_number: "+14155550199",
      provider: "twilio",
      provider_sid: "PN123",
      provisioning_source: "trial",
      released_at: null,
      release_reason: null,
      restaurant_main_line: "+14155550148",
      sms_webhook_url: "https://voice.signalhost.test/twilio/sms",
      status: "in-use",
      trial_ends_at: "2026-05-12T14:00:00.000Z",
      trial_grace_ends_at: "2026-05-26T14:00:00.000Z",
      trial_started_at: "2026-05-05T14:00:00.000Z",
      updated_at: "2026-05-05T14:00:00.000Z",
      verification_results: {
        busyForwarding: "failed",
        directCall: "passed",
        noAnswerForwarding: "passed",
        updatedAt: "2026-05-05T14:01:00.000Z",
      },
      voice_webhook_url: "https://voice.signalhost.test/twilio/voice",
    });

    expect(phoneNumber).toEqual({
      createdAt: "2026-05-05T13:59:00.000Z",
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
      provisioningSource: "trial",
      releasedAt: undefined,
      releaseReason: undefined,
      restaurantMainLine: "+14155550148",
      smsWebhookUrl: "https://voice.signalhost.test/twilio/sms",
      status: "in-use",
      trialEndsAt: "2026-05-12T14:00:00.000Z",
      trialGraceEndsAt: "2026-05-26T14:00:00.000Z",
      trialStartedAt: "2026-05-05T14:00:00.000Z",
      updatedAt: "2026-05-05T14:00:00.000Z",
      voiceWebhookUrl: "https://voice.signalhost.test/twilio/voice",
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
