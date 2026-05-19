import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import { authorizeVoiceAdminRequest } from "./admin-auth";
import { generateAgentTestReply, type AgentTestReplyInput } from "./agent-test";
import { getStripeBillingReadiness } from "./billing-readiness";
import { createBillingService } from "./billing-service";
import { listBillingPlans } from "./billing-plans";
import { createBillingStore } from "./billing-store";
import { createCallStore } from "./call-store";
import { createConversationRelayHandler } from "./conversation-relay";
import { createCustomerFollowUpService, type CustomerFollowUpInput } from "./customer-follow-up-service";
import { createEmailDeliveryService } from "./email-delivery-service";
import { getEmailReadiness } from "./email-readiness";
import { createGuestConfirmationService } from "./guest-confirmation-service";
import { createOpenAIVoicePreview } from "./openai-voice-preview";
import { getVoiceServiceReadiness, loadEnv, type VoiceServiceEnv } from "./env";
import { buildLiveCallConfig } from "./live-call";
import {
  buildLiveKitPilotConfig,
  buildLiveKitTwiML,
  HARBOR_PLUMBING_DEMO_LOCATION_ID,
  isLiveKitTwilioWebhookEnabled,
  shouldRouteTwilioVoiceToLiveKit,
} from "./livekit-handoff";
import {
  checkDistributedRateLimit,
  getRequestIp,
  HttpRequestError,
  parseJsonRequestBody,
  readLimitedRequestBody,
} from "./http-safety";
import { createMenuIngestionService } from "./menu-ingestion-service";
import { recordHttpRequestMetric, renderPrometheusMetrics } from "./metrics";
import { buildSmsTwiML, createMessageThreadStore } from "./message-thread-store";
import { createStaffNotificationService } from "./notification-service";
import { buildOpenAIRealtimeLiveCallConfig, createOpenAIRealtimeSipService } from "./openai-realtime-sip";
import { createOwnerCommandRuntime } from "./owner-command-runtime";
import { createOwnerEmailCommandService, type OwnerEmailCommandInput } from "./owner-email-command-service";
import { createOwnerReportService } from "./owner-report-service";
import { createPlatformIntegrationRegistry } from "./platform-integrations";
import { createPhoneNumberStore } from "./phone-number-store";
import { createRestaurantContextStore } from "./restaurant-context-store";
import { createReservationPlatformService } from "./reservation-platform-service";
import { createResendInboundEmailService } from "./resend-inbound-email-service";
import { createTenantProvisioningService, type TenantBootstrapInput } from "./tenant-provisioning";
import { createTelephonyService } from "./telephony";
import { releaseExpiredTrialNumbers } from "./trial-number-cleanup";
import {
  buildSignalHostRecordingPlaybackUrl,
  buildTwilioRecordingMediaUrl,
  createTwilioCallRecordingService,
  resolveRecordingCallbackExternalCallSid,
  validateRecordingPlaybackToken,
} from "./twilio-recording-service";
import { demoRestaurantContext } from "./restaurant-context";
import { generateRestaurantReply } from "./restaurant-agent";
import { buildSupabaseServiceHeaders } from "./supabase-headers";
import { validateTwilioSignature } from "./twilio-signature";
import { buildConversationRelayTwiML, buildEmptyTwiML, buildHangupTwiML, buildUnavailableTwiML } from "./twiml";
import { resolveConversationRelayTtsVoice } from "./voice-selection";
import { createWebChatService, type WebChatMessageInput } from "./web-chat";

const env = loadEnv();
const billingStore = createBillingStore(env);
const callStore = createCallStore(env);
const phoneNumberStore = createPhoneNumberStore(env);
const billingService = createBillingService(env, billingStore, phoneNumberStore);
const restaurantContextStore = createRestaurantContextStore(env);
const telephonyService = createTelephonyService(env);
const callRecordingService = createTwilioCallRecordingService(env);
const emailDeliveryService = createEmailDeliveryService(env);
const customerFollowUpService = createCustomerFollowUpService(env, emailDeliveryService);
const staffNotificationService = createStaffNotificationService(env, { emailDeliveryService });
const guestConfirmationService = createGuestConfirmationService(env);
const menuIngestionService = createMenuIngestionService(env);
const ownerReportService = createOwnerReportService(env, { emailDeliveryService });
const ownerCommandRuntime = createOwnerCommandRuntime(env, ownerReportService);
const ownerEmailCommandService = createOwnerEmailCommandService(env, ownerCommandRuntime);
const resendInboundEmailService = createResendInboundEmailService(
  env,
  ownerEmailCommandService,
  emailDeliveryService,
);
const messageThreadStore = createMessageThreadStore(env, { ownerCommandRuntime });
const platformIntegrationRegistry = createPlatformIntegrationRegistry(env);
const reservationPlatformService = createReservationPlatformService(env);
const tenantProvisioningService = createTenantProvisioningService(env);
const openAIRealtimeSipService = createOpenAIRealtimeSipService(env, restaurantContextStore, {
  callStore,
  callRecordingService,
  guestConfirmationService,
  ownerCommandRuntime,
  reservationPlatformService,
  staffNotificationService,
});
const webChatService = createWebChatService(env, restaurantContextStore, { callStore });
const ADMIN_BODY_LIMIT_BYTES = 16 * 1024;
const BILLING_BODY_LIMIT_BYTES = 32 * 1024;
const CALL_DEBUG_AUDIO_LIMIT_BYTES = 25 * 1024 * 1024;
const OPENAI_WEBHOOK_BODY_LIMIT_BYTES = 32 * 1024;
const OWNER_EMAIL_BODY_LIMIT_BYTES = 64 * 1024;
const PREVIEW_BODY_LIMIT_BYTES = 4 * 1024;
const RESEND_INBOUND_BODY_LIMIT_BYTES = 128 * 1024;
const TENANT_BOOTSTRAP_BODY_LIMIT_BYTES = 64 * 1024;
const TWILIO_BODY_LIMIT_BYTES = 16 * 1024;
const WEB_CHAT_BODY_LIMIT_BYTES = 16 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const LIVEKIT_RECORDING_START_DELAYS_MS = [3_500, 8_500];
const server = createServer((req, res) => {
  const startedAt = Date.now();
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  res.once("finish", () => {
    recordHttpRequestMetric({
      durationMs: Date.now() - startedAt,
      method: req.method ?? "UNKNOWN",
      path,
      statusCode: res.statusCode,
    });
  });
  void handleRequest(req, res, env).catch((error) => {
    console.error("[voice-service] unhandled request failed", error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Voice service request failed" });
      return;
    }
    res.end();
  });
});

const wss = new WebSocketServer({ noServer: true });
const activeRelaySockets = new Set<WebSocket>();
const activeRelayCompletions = new Set<Promise<void>>();
const handleConversationRelayConnection = createConversationRelayHandler(
  env,
  callStore,
  restaurantContextStore,
  staffNotificationService,
  guestConfirmationService,
  {
    onSessionCompletion: trackRelayCompletion,
  },
);

server.on("upgrade", (req, socket, head) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (path !== "/twilio/conversation-relay") {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
    return;
  }

  if (!isValidTwilioUpgrade(req, env)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    activeRelaySockets.add(ws);
    ws.once("close", () => activeRelaySockets.delete(ws));
    handleConversationRelayConnection(ws, req);
  });
});

server.listen(env.PORT, () => {
  console.info(`[voice-service] listening on http://localhost:${env.PORT}`);
});

process.once("SIGTERM", () => void shutdownGracefully("SIGTERM"));
process.once("SIGINT", () => void shutdownGracefully("SIGINT"));

async function handleRequest(req: IncomingMessage, res: ServerResponse, currentEnv: VoiceServiceEnv) {
  const url = new URL(req.url ?? "/", "http://localhost");
  applyCors(req, res, currentEnv);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    const readiness = getVoiceServiceReadiness(currentEnv);
    const liveKitHarborPilot = buildLiveKitPilotConfig(currentEnv, HARBOR_PLUMBING_DEMO_LOCATION_ID);
    const openAIRealtimeConfig = openAIRealtimeSipService.getLiveCallConfig(currentEnv.SUPABASE_DEMO_LOCATION_ID);
    sendJson(res, 200, {
      ok: true,
      service: "signalhost-voice",
      productionReady: readiness.productionReady,
      readinessChecks: readiness.checks,
      openaiConfigured: Boolean(currentEnv.OPENAI_API_KEY),
      openAIVoiceConfigured: Boolean(currentEnv.OPENAI_API_KEY),
      elevenLabsConfigured: Boolean(currentEnv.ELEVENLABS_API_KEY),
      supabaseConfigured: Boolean(
        currentEnv.SUPABASE_URL &&
          currentEnv.SUPABASE_SECRET_KEY &&
          currentEnv.SUPABASE_DEMO_LOCATION_ID,
      ),
      onboardedContextConfigured: Boolean(
        currentEnv.SUPABASE_URL &&
          currentEnv.SUPABASE_SECRET_KEY &&
          currentEnv.SUPABASE_DEMO_LOCATION_ID,
      ),
      menuIngestionConfigured: menuIngestionService.configured,
      callRecordingConfigured: callRecordingService.configured,
      liveKitConfigured: Boolean(currentEnv.LIVEKIT_URL && currentEnv.LIVEKIT_API_KEY && currentEnv.LIVEKIT_API_SECRET),
      liveKitHarborPilotConfigured: liveKitHarborPilot.ready,
      liveKitHarborPilotRoutingEnabled: liveKitHarborPilot.routeOnTwilioVoice,
      liveKitTwilioWebhookEnabled: liveKitHarborPilot.twilioWebhookEnabled,
      openAIRealtimeSipConfigured: openAIRealtimeSipService.configured,
      openAIRealtimeConfig: {
        acceptProvider: openAIRealtimeConfig.acceptProvider,
        greetingDelayMs: openAIRealtimeConfig.greetingDelayMs,
        model: openAIRealtimeConfig.model,
        noiseReduction: openAIRealtimeConfig.noiseReduction,
        speed: openAIRealtimeConfig.speed,
        turnDetection: openAIRealtimeConfig.turnDetection,
        voice: openAIRealtimeConfig.voice,
      },
      ownerReportDeliveryConfigured: ownerReportService.deliveryConfigured,
      ownerReportsConfigured: ownerReportService.configured,
      ownerEmailCommandsConfigured: ownerEmailCommandService.configured,
      customerFollowUpsConfigured: customerFollowUpService.configured && emailDeliveryService.configured,
      emailDeliveryConfigured: emailDeliveryService.configured,
      resendInboundEmailConfigured: resendInboundEmailService.configured,
      resendInboundEmailVerificationConfigured: resendInboundEmailService.verificationConfigured,
      platformIntegrations: platformIntegrationRegistry.summary,
      tenantProvisioningConfigured: tenantProvisioningService.configured,
      stripeBillingConfigured: billingService.configured,
      twilioProvisioningConfigured: telephonyService.configured,
      staffAlertsConfigured: staffNotificationService.configured,
      guestConfirmationsConfigured: guestConfirmationService.configured,
      sharedSmsRoutingConfigured: Boolean(
        currentEnv.SUPABASE_URL &&
          currentEnv.SUPABASE_SECRET_KEY &&
          currentEnv.SUPABASE_DEMO_LOCATION_ID &&
          (currentEnv.TWILIO_MESSAGING_SERVICE_SID || currentEnv.TWILIO_SMS_FROM_NUMBER),
      ),
      twilioSignatureRequired: currentEnv.REQUIRE_TWILIO_SIGNATURE,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/ready") {
    const readiness = getVoiceServiceReadiness(currentEnv);
    sendJson(res, readiness.productionReady ? 200 : 503, {
      ok: readiness.productionReady,
      productionReady: readiness.productionReady,
      readinessChecks: readiness.checks,
      service: "signalhost-voice",
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/integrations/platforms") {
    const locationId = url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
    const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
      return;
    }

    sendJson(res, 200, createPlatformIntegrationRegistry(currentEnv));
    return;
  }

  if (req.method === "GET" && url.pathname === "/metrics") {
    sendPrometheus(res, 200, renderPrometheusMetrics({
      activeOpenAIRealtimeSockets: openAIRealtimeSipService.activeSocketCount,
      activeRelayCompletions: activeRelayCompletions.size,
      activeRelaySockets: activeRelaySockets.size,
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/tenant/bootstrap") {
    if (!(await allowRateLimitedRequest(req, res, "tenant-bootstrap", 20, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, TENANT_BOOTSTRAP_BODY_LIMIT_BYTES)) as TenantBootstrapInput;
      const result = await tenantProvisioningService.bootstrap(body, req.headers.authorization);
      sendJson(res, 200, result);
    } catch (error) {
      sendCaughtError(res, error, "Tenant provisioning failed");
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/billing/plans") {
    const businessType = url.searchParams.get("businessType") ?? undefined;
    sendJson(res, 200, {
      plans: listBillingPlans({ businessType }),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/billing/readiness") {
    const locationId = url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
    const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
      return;
    }

    sendJson(res, 200, getStripeBillingReadiness(currentEnv));
    return;
  }

  if (req.method === "GET" && url.pathname === "/email/readiness") {
    const locationId = url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
    const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
      return;
    }

    const readiness = getEmailReadiness(currentEnv);
    sendJson(res, readiness.ready ? 200 : 503, readiness);
    return;
  }

  if (req.method === "GET" && url.pathname === "/billing/status") {
    const locationId = url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
    const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
      return;
    }

    try {
      sendJson(res, 200, await billingService.getStatus(locationId ?? undefined));
    } catch (error) {
      sendCaughtError(res, error, "Billing status failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/billing/checkout-session") {
    if (!(await allowRateLimitedRequest(req, res, "billing-checkout", 20, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        businessType?: string;
        cancelUrl?: string;
        customerEmail?: string;
        locationId?: string;
        planId?: string;
        planName?: string;
        successUrl?: string;
      };
      const locationId = body.locationId ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
      const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const session = await billingService.createCheckoutSession({ ...body, locationId: locationId ?? undefined }, req.headers);
      sendJson(res, 200, session);
    } catch (error) {
      sendCaughtError(res, error, "Stripe checkout failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/billing/customer-portal") {
    if (!(await allowRateLimitedRequest(req, res, "billing-portal", 20, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        locationId?: string;
        returnUrl?: string;
      };
      const locationId = body.locationId ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
      const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const session = await billingService.createCustomerPortalSession({ ...body, locationId: locationId ?? undefined }, req.headers);
      sendJson(res, 200, session);
    } catch (error) {
      sendCaughtError(res, error, "Stripe customer portal failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/stripe/webhook") {
    try {
      const rawBody = await readLimitedRequestBody(req, BILLING_BODY_LIMIT_BYTES);
      const result = await billingService.handleWebhook({
        rawBody,
        signature: firstHeader(req.headers["stripe-signature"]),
      });
      sendJson(res, 200, result);
    } catch (error) {
      sendCaughtError(res, error, "Stripe webhook failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/owner-reports/daily") {
    if (!(await allowRateLimitedRequest(req, res, "owner-daily-report", 20, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        locationId?: string;
      };
      const locationId = body.locationId ?? url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
      const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const result = await ownerReportService.generateDailyReport({ locationId: locationId ?? undefined });
      sendJson(res, 200, result);
    } catch (error) {
      sendCaughtError(res, error, "Owner daily report failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/owner-reports/daily/deliver") {
    if (!(await allowRateLimitedRequest(req, res, "owner-daily-report-deliver", 10, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        locationId?: string;
      };
      const locationId = body.locationId ?? url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
      const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const result = await ownerReportService.deliverDailyReport({ locationId: locationId ?? undefined });
      sendJson(res, 200, result);
    } catch (error) {
      sendCaughtError(res, error, "Owner daily report delivery failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/customer-follow-ups/send") {
    if (!(await allowRateLimitedRequest(req, res, "customer-follow-up-send", 30, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as CustomerFollowUpInput;
      const locationId = body.locationId?.trim() || url.searchParams.get("locationId") || currentEnv.SUPABASE_DEMO_LOCATION_ID;
      const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const result = await customerFollowUpService.sendFollowUp({
        ...body,
        locationId: locationId ?? body.locationId,
      });
      sendJson(res, 200, result);
    } catch (error) {
      sendCaughtError(res, error, "Customer follow-up failed");
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/openai/realtime/live-call-config") {
    const locationId = url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
    const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
      return;
    }

    const config = openAIRealtimeSipService.getLiveCallConfig(locationId ?? undefined);
    sendJson(res, config.ready ? 200 : 503, config);
    return;
  }

  if (req.method === "GET" && url.pathname === "/openai/realtime/preflight") {
    const locationId = url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
    const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
      return;
    }

    const preflight = await openAIRealtimeSipService.getPreflight(locationId ?? undefined);
    sendJson(res, preflight.ready ? 200 : 503, preflight);
    return;
  }

  if (req.method === "GET" && url.pathname === "/openai/agents/realtime/preflight") {
    const locationId = url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
    const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
      return;
    }

    const { buildOpenAIAgentsRealtimePreflight } = await import("./openai-agents-realtime-spike");
    const preflight = await buildOpenAIAgentsRealtimePreflight({
      callerPhone: url.searchParams.get("callerPhone") ?? undefined,
      env: currentEnv,
      locationId: locationId ?? undefined,
      restaurantContextStore,
    });
    sendJson(res, preflight.ready ? 200 : 503, preflight);
    return;
  }

  if (req.method === "GET" && url.pathname === "/livekit/pilot-config") {
    const locationId = url.searchParams.get("locationId") ?? HARBOR_PLUMBING_DEMO_LOCATION_ID;
    const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
      return;
    }

    const config = buildLiveKitPilotConfig(currentEnv, locationId ?? undefined);
    sendJson(res, config.ready ? 200 : 503, config);
    return;
  }

  if (req.method === "POST" && url.pathname === "/openai/realtime/webhook") {
    try {
      const result = await openAIRealtimeSipService.handleIncomingWebhook({
        headers: req.headers,
        locationId: url.searchParams.get("locationId") ?? undefined,
        rawBody: await readLimitedRequestBody(req, OPENAI_WEBHOOK_BODY_LIMIT_BYTES),
      });
      sendJson(res, result.status, result.body);
    } catch (error) {
      console.error("[voice-service] OpenAI Realtime webhook failed", error);
      sendJson(res, 500, { error: "OpenAI Realtime webhook failed" });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/twilio/live-call-config") {
    const authorization = await authorizeVoiceAdminRequest({
      currentEnv,
      locationId: url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID,
      req,
    });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
      return;
    }

    const liveCallConfig = buildLiveCallConfig(currentEnv, url.searchParams.get("locationId") ?? undefined);
    sendJson(res, liveCallConfig.ready ? 200 : 503, liveCallConfig);
    return;
  }

  if (req.method === "GET" && url.pathname === "/twilio/twiml-preview") {
    const locationId = url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID ?? "demo-location";
    const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
    if (!authorization.authorized) {
      sendText(res, authorization.status, authorization.reason ?? "Unauthorized");
      return;
    }

    const liveCallConfig = buildLiveCallConfig(currentEnv, locationId);
    if (!liveCallConfig.conversationRelayUrl) {
      sendXml(res, 503, buildUnavailableTwiML("SignalHost needs PUBLIC_WS_BASE_URL before live calls."));
      return;
    }

    const restaurantContext = await restaurantContextStore.getContext(locationId);
    const ttsVoice = resolveConversationRelayTtsVoice(currentEnv, restaurantContext);
      const twiml = buildConversationRelayTwiML({
        actionUrl: liveCallConfig.actionUrl,
        customParameters: { locationId },
        language: currentEnv.TWILIO_LANGUAGE,
        speechTimeoutMs: currentEnv.TWILIO_SPEECH_TIMEOUT_MS,
        transcriptionProvider: currentEnv.TWILIO_TRANSCRIPTION_PROVIDER,
        ttsProvider: currentEnv.TWILIO_TTS_PROVIDER,
        ttsVoice,
        websocketUrl: liveCallConfig.conversationRelayUrl,
      });

    sendXml(res, 200, twiml);
    return;
  }

  if (req.method === "GET" && url.pathname === "/twilio/livekit-twiml-preview") {
    const locationId = url.searchParams.get("locationId") ?? HARBOR_PLUMBING_DEMO_LOCATION_ID;
    const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
    if (!authorization.authorized) {
      sendText(res, authorization.status, authorization.reason ?? "Unauthorized");
      return;
    }

    const twiml = buildLiveKitTwiML({
      dialedPhone: url.searchParams.get("dialedPhone") ?? undefined,
      env: currentEnv,
      locationId: locationId ?? undefined,
    });
    if (!twiml) {
      sendXml(res, 503, buildUnavailableTwiML("LiveKit pilot routing needs the SIP endpoint, SIP auth, and pilot phone number."));
      return;
    }

    sendXml(res, 200, twiml);
    return;
  }

  if (req.method === "POST" && url.pathname === "/ingestion/run-next") {
    if (!(await allowRateLimitedRequest(req, res, "ingestion", 20, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        jobId?: string;
        locationId?: string;
      };
      const authorization = await authorizeVoiceAdminRequest({
        currentEnv,
        locationId: body.locationId ?? currentEnv.SUPABASE_DEMO_LOCATION_ID,
        req,
      });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const result = await menuIngestionService.runNext({
        jobId: body.jobId,
        locationId: body.locationId ?? currentEnv.SUPABASE_DEMO_LOCATION_ID,
      });
      sendJson(res, 200, result);
    } catch (error) {
      sendCaughtError(res, error, "Menu ingestion failed");
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/telephony/available-numbers") {
    if (!(await allowRateLimitedRequest(req, res, "number-search", 45, currentEnv))) return;

    const authorization = await authorizeVoiceAdminRequest({
      currentEnv,
      locationId: url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID,
      req,
    });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
      return;
    }

    try {
      const numbers = await telephonyService.searchAvailableNumbers({
        areaCode: url.searchParams.get("areaCode") ?? undefined,
        contains: url.searchParams.get("contains") ?? undefined,
        country: url.searchParams.get("country") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? "5"),
      });
      sendJson(res, 200, { numbers });
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Twilio number search failed" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/telephony/provision-number") {
    if (!(await allowRateLimitedRequest(req, res, "number-provision", 10, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        allowAdditionalNumber?: boolean;
        areaCode?: string;
        contains?: string;
        country?: string;
        forwardingMode?: string;
        locationId?: string;
        makePrimary?: boolean;
        phoneNumber?: string;
        restaurantMainLine?: string;
        trialDays?: number;
        trialGraceDays?: number;
      };
      const locationId = body.locationId ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;

      const authorization = await authorizeVoiceAdminRequest({
        currentEnv,
        locationId,
        req,
      });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const guard = await phoneNumberStore.getLocationProvisioningGuard(locationId);
      if (!guard.allowed && !body.allowAdditionalNumber) {
        sendJson(res, 409, {
          code: guard.reason,
          error: guard.reason === "trial_grace_expired"
            ? "This location already has a trial number past its cleanup date. Release it or upgrade before provisioning another number."
            : "This location already has an active SignalHost phone number.",
          locationId: guard.locationId,
          phoneNumber: guard.existingPhoneNumber,
          trialGraceEndsAt: guard.trialGraceEndsAt,
        });
        return;
      }

      const selectedPhoneNumber = body.phoneNumber?.trim() || await findFirstAvailablePhoneNumber({
        areaCode: body.areaCode,
        contains: body.contains,
        country: body.country,
      });
      if (!selectedPhoneNumber) {
        sendJson(res, 404, { error: "No available Twilio number matched that search." });
        return;
      }

      const input = {
        forwardingMode: body.forwardingMode,
        locationId,
        makePrimary: body.makePrimary,
        phoneNumber: selectedPhoneNumber,
        restaurantMainLine: body.restaurantMainLine,
        trialDays: body.trialDays,
        trialGraceDays: body.trialGraceDays,
      };
      const provisioned = await telephonyService.provisionPhoneNumber(input);
      try {
        await phoneNumberStore.saveProvisionedNumber(input, provisioned);
      } catch (error) {
        if (provisioned.providerSid) {
          await telephonyService.releasePhoneNumber({ providerSid: provisioned.providerSid }).catch((cleanupError) => {
            console.warn("[voice-service] failed to release newly provisioned number after Supabase save failure", {
              cleanupError,
              phoneNumber: provisioned.phoneNumber,
              providerSid: provisioned.providerSid,
            });
          });
        }
        throw error;
      }
      sendJson(res, 200, { phoneNumber: provisioned });
    } catch (error) {
      sendCaughtError(res, error, "Twilio number provisioning failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/telephony/attach-number") {
    if (!(await allowRateLimitedRequest(req, res, "number-attach", 20, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        allowAdditionalNumber?: boolean;
        capabilities?: Record<string, boolean>;
        forwardingMode?: string;
        locationId?: string;
        makePrimary?: boolean;
        phoneNumber?: string;
        providerSid?: string;
        restaurantMainLine?: string;
        status?: string;
        trialDays?: number;
        trialGraceDays?: number;
        voiceWebhookUrl?: string;
      };
      const locationId = body.locationId ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
      const phoneNumber = normalizeAttachedPhoneNumber(body.phoneNumber);
      if (!phoneNumber) {
        sendJson(res, 400, { error: "phoneNumber is required." });
        return;
      }

      const authorization = await authorizeVoiceAdminRequest({
        currentEnv,
        locationId,
        req,
      });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const guard = await phoneNumberStore.getLocationProvisioningGuard(locationId);
      if (!guard.allowed && !body.allowAdditionalNumber && guard.existingPhoneNumber !== phoneNumber) {
        sendJson(res, 409, {
          code: guard.reason,
          error: "This location already has another active SignalHost phone number.",
          locationId: guard.locationId,
          phoneNumber: guard.existingPhoneNumber,
          trialGraceEndsAt: guard.trialGraceEndsAt,
        });
        return;
      }

      const twilioNumber = body.providerSid?.trim()
        ? undefined
        : await telephonyService.findIncomingPhoneNumber({ phoneNumber }).catch((error) => {
            console.warn("[voice-service] existing Twilio number lookup failed", { error, phoneNumber });
            return undefined;
          });
      const providerSid = body.providerSid?.trim() || twilioNumber?.providerSid;
      if (!providerSid) {
        sendJson(res, 400, {
          error: "Could not find this number in Twilio. Paste the Twilio Incoming Phone Number SID, or confirm the number belongs to the connected Twilio account.",
        });
        return;
      }

      const attached = {
        capabilities: body.capabilities ?? twilioNumber?.capabilities ?? {},
        phoneNumber,
        providerSid,
        status: body.status?.trim() || twilioNumber?.status || "active",
        voiceWebhookUrl: body.voiceWebhookUrl?.trim() || twilioNumber?.voiceWebhookUrl || buildOpenAIRealtimeLiveCallConfig(currentEnv, locationId).webhookUrl,
      };
      await phoneNumberStore.saveProvisionedNumber({
        forwardingMode: body.forwardingMode,
        locationId,
        makePrimary: body.makePrimary,
        phoneNumber,
        restaurantMainLine: body.restaurantMainLine,
        trialDays: body.trialDays,
        trialGraceDays: body.trialGraceDays,
      }, attached);
      sendJson(res, 200, { phoneNumber: attached });
    } catch (error) {
      sendCaughtError(res, error, "Existing Twilio number attach failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/telephony/repair-openai-sip-routing") {
    if (!(await allowRateLimitedRequest(req, res, "number-repair-openai-sip", 20, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        forwardingMode?: string;
        locationId?: string;
        makePrimary?: boolean;
        phoneNumber?: string;
        providerSid?: string;
        restaurantMainLine?: string;
      };
      const locationId = body.locationId ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;

      const authorization = await authorizeVoiceAdminRequest({
        currentEnv,
        locationId,
        req,
      });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const repaired = await telephonyService.repairOpenAIRealtimeSipRouting({
        locationId,
        phoneNumber: normalizeAttachedPhoneNumber(body.phoneNumber),
        providerSid: body.providerSid,
      });

      await phoneNumberStore.saveProvisionedNumber({
        forwardingMode: body.forwardingMode ?? "forward_unanswered",
        locationId,
        makePrimary: body.makePrimary,
        phoneNumber: repaired.phoneNumber,
        restaurantMainLine: body.restaurantMainLine,
      }, repaired);
      sendJson(res, 200, { phoneNumber: repaired });
    } catch (error) {
      sendCaughtError(res, error, "Twilio number SIP repair failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/telephony/release-number") {
    if (!(await allowRateLimitedRequest(req, res, "number-release", 20, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        id?: string;
        locationId?: string;
        phoneNumber?: string;
        providerSid?: string;
        releaseReason?: string;
      };
      if (!body.providerSid?.trim()) {
        sendJson(res, 400, { error: "providerSid is required to release a Twilio number." });
        return;
      }

      const authorization = await authorizeVoiceAdminRequest({
        currentEnv,
        locationId: body.locationId ?? currentEnv.SUPABASE_DEMO_LOCATION_ID,
        req,
      });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const released = await telephonyService.releasePhoneNumber({ providerSid: body.providerSid.trim() });
      await phoneNumberStore.markNumberReleased({
        id: body.id,
        locationId: body.locationId,
        phoneNumber: body.phoneNumber,
        providerSid: body.providerSid,
        releaseReason: body.releaseReason ?? "manual_release",
      });
      sendJson(res, 200, { phoneNumber: released });
    } catch (error) {
      sendCaughtError(res, error, "Twilio number release failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/telephony/release-expired-trials") {
    if (!isValidInternalRequest(req, currentEnv)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    try {
      const rawBody = await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES);
      const body: { dryRun?: boolean; limit?: number; now?: string } = rawBody.trim()
        ? parseJsonRequestBody(rawBody) as { dryRun?: boolean; limit?: number; now?: string }
        : {};
      const result = await releaseExpiredTrialNumbers(
        {
          billingService,
          phoneNumberStore,
          telephonyService,
        },
        {
          dryRun: body.dryRun,
          limit: body.limit,
          now: body.now ? new Date(body.now) : undefined,
        },
      );

      sendJson(res, result.failed.length ? 207 : 200, result);
    } catch (error) {
      sendCaughtError(res, error, "Expired trial release failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/twilio/livekit-voice") {
    try {
      const rawBody = await readLimitedRequestBody(req, TWILIO_BODY_LIMIT_BYTES);
      const params = Object.fromEntries(new URLSearchParams(rawBody));

      if (!isValidTwilioWebhook(req, currentEnv, params)) {
        console.warn("[voice-service] rejected unsigned LiveKit Twilio webhook", {
          callSid: firstNonEmpty(params.CallSid, params.callSid),
          from: firstNonEmpty(params.From, params.from),
          to: firstNonEmpty(params.To, params.to),
        });
        sendText(res, 401, "Invalid Twilio signature");
        return;
      }

      const locationId =
        params.locationId ??
        url.searchParams.get("locationId") ??
        HARBOR_PLUMBING_DEMO_LOCATION_ID;
      const callSid = firstNonEmpty(params.CallSid, params.callSid);
      const callerPhone = firstNonEmpty(params.From, params.from);
      const dialedPhone = firstNonEmpty(params.To, params.to);
      if (!isLiveKitTwilioWebhookEnabled(currentEnv)) {
        console.warn("[voice-service] rejected direct LiveKit Twilio webhook because pilot endpoint is quarantined", {
          callSid,
          callerPhone,
          dialedPhone,
          locationId,
        });
        sendXml(
          res,
          503,
          buildUnavailableTwiML("SignalHost LiveKit test routing is disabled. Please switch this number back to the OpenAI Realtime SIP route."),
        );
        return;
      }
      console.info("[voice-service] LiveKit pilot webhook received", {
        callSid,
        callerPhone,
        dialedPhone,
        locationId,
        userAgent: req.headers["user-agent"],
      });
      const twiml = buildLiveKitTwiML({
        callSid,
        dialedPhone,
        env: currentEnv,
        locationId,
      });
      if (!twiml) {
        console.warn("[voice-service] LiveKit pilot webhook is not ready", {
          callSid,
          callerPhone,
          dialedPhone,
          locationId,
        });
        sendXml(res, 503, buildUnavailableTwiML("SignalHost LiveKit pilot needs SIP routing setup before this test call."));
        return;
      }

      console.info("[voice-service] LiveKit pilot TwiML issued", {
        callSid,
        dialedPhone,
        locationId,
        sipTarget: summarizeSipTarget(twiml),
        twimlLength: twiml.length,
      });
      sendXml(res, 200, twiml);
      scheduleLiveKitCallRecordingStart({ callSid, locationId });
    } catch (error) {
      if (error instanceof HttpRequestError) {
        sendText(res, error.statusCode, error.message);
      } else {
        console.error("[voice-service] Twilio LiveKit voice webhook failed", error);
        sendXml(res, 500, buildUnavailableTwiML("SignalHost hit a LiveKit setup issue. Please try again soon."));
      }
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/twilio/voice") {
    try {
      const rawBody = await readLimitedRequestBody(req, TWILIO_BODY_LIMIT_BYTES);
      const params = Object.fromEntries(new URLSearchParams(rawBody));

      if (!isValidTwilioWebhook(req, currentEnv, params)) {
        sendText(res, 401, "Invalid Twilio signature");
        return;
      }

      const locationId =
        params.locationId ??
        url.searchParams.get("locationId") ??
        currentEnv.SUPABASE_DEMO_LOCATION_ID ??
        "demo-location";
      if (shouldRouteTwilioVoiceToLiveKit(currentEnv, locationId)) {
        const twiml = buildLiveKitTwiML({
          callSid: firstNonEmpty(params.CallSid, params.callSid),
          dialedPhone: firstNonEmpty(params.To, params.to),
          env: currentEnv,
          locationId,
        });
        if (!twiml) {
          console.warn("[voice-service] LiveKit pilot routing switch is enabled but not ready", {
            callSid: params.CallSid ?? params.callSid,
            locationId,
          });
          sendXml(res, 503, buildUnavailableTwiML("SignalHost LiveKit pilot needs SIP routing setup before this test call."));
          return;
        }

        sendXml(res, 200, twiml);
        return;
      }

      if (!currentEnv.PUBLIC_WS_BASE_URL) {
        sendXml(res, 503, buildUnavailableTwiML());
        return;
      }

      const twilioCallSid = firstNonEmpty(params.CallSid, params.callSid);
      if (twilioCallSid) {
        void callRecordingService.startCallRecording({
          externalCallSid: twilioCallSid,
          locationId,
        }).catch((error) => {
          console.warn("[voice-service] Twilio call recording start failed", {
            callSid: twilioCallSid,
            error,
            locationId,
          });
        });
      }
      const restaurantContext = await restaurantContextStore.getContext(locationId);
      const liveCallConfig = buildLiveCallConfig(currentEnv, locationId);
      const ttsVoice = resolveConversationRelayTtsVoice(currentEnv, restaurantContext);
      const callSessionKey = getStableCallSessionKey(params);
      const actionUrl = liveCallConfig.actionUrl && callSessionKey
        ? withQueryParam(liveCallConfig.actionUrl, "callSessionKey", callSessionKey)
        : liveCallConfig.actionUrl;
      const twiml = buildConversationRelayTwiML({
        actionUrl,
        customParameters: buildRelayCustomParameters(params, locationId, callSessionKey),
        language: currentEnv.TWILIO_LANGUAGE,
        speechTimeoutMs: currentEnv.TWILIO_SPEECH_TIMEOUT_MS,
        transcriptionProvider: currentEnv.TWILIO_TRANSCRIPTION_PROVIDER,
        ttsProvider: currentEnv.TWILIO_TTS_PROVIDER,
        ttsVoice,
        websocketUrl: liveCallConfig.conversationRelayUrl ?? `${currentEnv.PUBLIC_WS_BASE_URL}/twilio/conversation-relay`,
      });

      sendXml(res, 200, twiml);
    } catch (error) {
      if (error instanceof HttpRequestError) {
        sendText(res, error.statusCode, error.message);
      } else {
        console.error("[voice-service] Twilio voice webhook failed", error);
        sendXml(res, 500, buildUnavailableTwiML("SignalHost hit a setup issue. Please try again soon."));
      }
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/twilio/sms") {
    try {
      const rawBody = await readLimitedRequestBody(req, TWILIO_BODY_LIMIT_BYTES);
      const params = Object.fromEntries(new URLSearchParams(rawBody));

      if (!isValidTwilioWebhook(req, currentEnv, params)) {
        sendText(res, 401, "Invalid Twilio signature");
        return;
      }

      const result = await messageThreadStore.handleInboundSms({
        body: firstNonEmpty(params.Body, params.body) ?? "",
        from: firstNonEmpty(params.From, params.from) ?? "",
        providerMessageSid: firstNonEmpty(params.MessageSid, params.SmsSid, params.messageSid),
        rawPayload: params,
        to: firstNonEmpty(params.To, params.to) ?? "",
      });

      sendXml(res, 200, buildSmsTwiML(result.replyMessage));
    } catch (error) {
      console.error("[voice-service] Twilio SMS webhook failed", error);
      sendXml(res, 200, buildSmsTwiML("SignalHost received your text, but routing needs staff review."));
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/twilio/recording-diagnostics") {
    const locationId = url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
    const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
      return;
    }

    const externalCallSid = url.searchParams.get("callSid") ?? undefined;
    if (!externalCallSid) {
      sendJson(res, 400, { error: "callSid is required." });
      return;
    }

    try {
      const recording = await callRecordingService.findCompletedCallRecording({ externalCallSid });
      if (recording.recordingUrl) {
        await callStore.attachCallRecording({
          durationSeconds: recording.durationSeconds,
          externalCallSid,
          recordingSid: recording.recordingSid,
          recordingUrl: recording.recordingUrl,
        });
      }
      sendJson(res, 200, {
        attached: Boolean(recording.recordingUrl),
        callRecordingConfigured: callRecordingService.configured,
        externalCallSid,
        recording,
      });
    } catch (error) {
      sendCaughtError(res, error, "Recording diagnostics failed");
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/debug/calls/latest") {
    const locationId = url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
    const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
      return;
    }

    try {
      const debugPack = await buildCallDebugPack({
        currentEnv,
        includeAudio: isTruthyQueryParam(url.searchParams.get("audio")),
        locationId: locationId ?? undefined,
      });
      sendJson(res, 200, debugPack);
    } catch (error) {
      sendCaughtError(res, error, "Call debug failed");
    }
    return;
  }

  const callDebugMatch = url.pathname.match(/^\/debug\/calls\/([^/]+)$/);
  if (req.method === "GET" && callDebugMatch) {
    const locationId = url.searchParams.get("locationId") ?? currentEnv.SUPABASE_DEMO_LOCATION_ID;
    const authorization = await authorizeVoiceAdminRequest({ currentEnv, locationId, req });
    if (!authorization.authorized) {
      sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
      return;
    }

    try {
      const debugPack = await buildCallDebugPack({
        callId: decodeURIComponent(callDebugMatch[1]),
        currentEnv,
        includeAudio: isTruthyQueryParam(url.searchParams.get("audio")),
        locationId: locationId ?? undefined,
      });
      sendJson(res, 200, debugPack);
    } catch (error) {
      sendCaughtError(res, error, "Call debug failed");
    }
    return;
  }

  const recordingPlaybackMatch = url.pathname.match(/^\/twilio\/recordings\/([^/]+)\.mp3$/);
  if (req.method === "GET" && recordingPlaybackMatch) {
    await streamTwilioRecordingPlayback({
      currentEnv,
      recordingSid: decodeURIComponent(recordingPlaybackMatch[1]),
      res,
      token: url.searchParams.get("token"),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/twilio/recording-status") {
    try {
      const rawBody = await readLimitedRequestBody(req, TWILIO_BODY_LIMIT_BYTES);
      const params = Object.fromEntries(new URLSearchParams(rawBody));

      if (!isValidTwilioWebhook(req, currentEnv, params)) {
        sendText(res, 401, "Invalid Twilio signature");
        return;
      }

      const recordingStatus = firstNonEmpty(params.RecordingStatus, params.recordingStatus)?.toLowerCase();
      if (recordingStatus && recordingStatus !== "completed") {
        console.info("[voice-service] received non-completed recording callback", {
          callSid: firstNonEmpty(params.CallSid, params.callSid, params.ParentCallSid, params.parentCallSid),
          recordingSid: firstNonEmpty(params.RecordingSid, params.recordingSid),
          recordingStatus,
        });
        sendJson(res, 200, { ignored: true, ok: true, recordingStatus });
        return;
      }

      const recordingSid = firstNonEmpty(params.RecordingSid, params.recordingSid);
      const recordingUrl =
        buildSignalHostRecordingPlaybackUrl({
          publicHttpBaseUrl: currentEnv.PUBLIC_HTTP_BASE_URL,
          recordingSid,
          signingSecret: currentEnv.TWILIO_AUTH_TOKEN,
        }) ?? normalizeRecordingUrl(firstNonEmpty(params.RecordingUrl, params.recordingUrl));
      const externalCallSid = resolveRecordingCallbackExternalCallSid({
        externalCallSidParam: url.searchParams.get("externalCallSid"),
        params,
      });
      const callRecordId = firstNonEmpty(params.callRecordId, params.CallRecordId, url.searchParams.get("callRecordId"));
      if (!recordingUrl || !externalCallSid) {
        sendJson(res, 400, { error: "RecordingUrl and CallSid are required." });
        return;
      }

      console.info("[voice-service] attaching Twilio recording", {
        callbackCallSid: firstNonEmpty(params.CallSid, params.callSid),
        callbackParentCallSid: firstNonEmpty(params.ParentCallSid, params.parentCallSid),
        callRecordId,
        externalCallSid,
        queryExternalCallSid: url.searchParams.get("externalCallSid"),
        recordingSid,
      });
      await callStore.attachCallRecording({
        callId: callRecordId,
        durationSeconds: parseOptionalSeconds(firstNonEmpty(params.RecordingDuration, params.recordingDuration)),
        externalCallSid,
        providerPayload: params,
        recordingSid,
        recordingUrl,
      });
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendCaughtError(res, error, "Recording callback failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/twilio/conversation-ended") {
    try {
      const rawBody = await readLimitedRequestBody(req, TWILIO_BODY_LIMIT_BYTES);
      const params = Object.fromEntries(new URLSearchParams(rawBody));

      if (!isValidTwilioWebhook(req, currentEnv, params)) {
        sendText(res, 401, "Invalid Twilio signature");
        return;
      }

      if (!currentEnv.PUBLIC_WS_BASE_URL) {
        sendXml(res, 200, buildEmptyTwiML());
        return;
      }

      const locationId =
        url.searchParams.get("locationId") ??
        params.locationId ??
        currentEnv.SUPABASE_DEMO_LOCATION_ID ??
        "demo-location";
      const handoffData = parseConversationRelayHandoffData(params.HandoffData ?? params.handoffData);
      await reconcileConversationRelayEndedCallback(params, handoffData).catch((error) => {
        console.warn("[voice-service] ConversationRelay callback reconciliation failed", {
          callSid: params.CallSid ?? params.callSid,
          error,
        });
      });

      if (handoffData.reasonCode === "natural_goodbye") {
        console.info("[voice-service] ending call after natural goodbye", {
          callSid: params.CallSid ?? params.callSid,
          locationId,
        });
        sendXml(res, 200, buildHangupTwiML());
        return;
      }

      if (isCompletedTwilioCall(params)) {
        sendXml(res, 200, buildEmptyTwiML());
        return;
      }

      const reconnectAttempt = Number.parseInt(url.searchParams.get("reconnectAttempt") ?? "0", 10);
      if (Number.isFinite(reconnectAttempt) && reconnectAttempt >= 5) {
        console.warn("[voice-service] ConversationRelay reconnect limit reached", {
          callSid: params.CallSid ?? params.callSid,
          locationId,
          reconnectAttempt,
        });
        sendXml(res, 200, buildEmptyTwiML());
        return;
      }

      const restaurantContext = await restaurantContextStore.getContext(locationId);
      const liveCallConfig = buildLiveCallConfig(currentEnv, locationId);
      const ttsVoice = resolveConversationRelayTtsVoice(currentEnv, restaurantContext);
      const callSessionKey = getStableCallSessionKey(params, url.searchParams.get("callSessionKey") ?? undefined);
      const reconnectActionUrl = withOptionalQueryParams(liveCallConfig.actionUrl, {
        callSessionKey,
        reconnectAttempt: String((reconnectAttempt || 0) + 1),
      });
      const twiml = buildConversationRelayTwiML({
        actionUrl: reconnectActionUrl,
        customParameters: buildRelayCustomParameters(params, locationId, callSessionKey),
        language: currentEnv.TWILIO_LANGUAGE,
        speechTimeoutMs: currentEnv.TWILIO_SPEECH_TIMEOUT_MS,
        transcriptionProvider: currentEnv.TWILIO_TRANSCRIPTION_PROVIDER,
        ttsProvider: currentEnv.TWILIO_TTS_PROVIDER,
        ttsVoice,
        websocketUrl: liveCallConfig.conversationRelayUrl ?? `${currentEnv.PUBLIC_WS_BASE_URL}/twilio/conversation-relay`,
      });

      console.warn("[voice-service] reconnecting ConversationRelay without replaying greeting", {
        callSid: params.CallSid ?? params.callSid,
        callSessionKey,
        locationId,
        reconnectAttempt: (reconnectAttempt || 0) + 1,
      });
      sendXml(res, 200, twiml);
    } catch (error) {
      if (error instanceof HttpRequestError) {
        sendText(res, error.statusCode, error.message);
      } else {
        console.error("[voice-service] ConversationRelay action callback failed", error);
        sendXml(res, 200, buildEmptyTwiML());
      }
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/voice/preview") {
    if (!(await allowRateLimitedRequest(req, res, "voice-preview", 20, currentEnv))) return;

    try {
      const authorization = await authorizeVoiceAdminRequest({
        currentEnv,
        locationId: currentEnv.SUPABASE_DEMO_LOCATION_ID,
        req,
      });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const body = parseJsonRequestBody(await readLimitedRequestBody(req, PREVIEW_BODY_LIMIT_BYTES)) as {
        text?: string;
        voiceGender?: string;
        voiceProfileId?: string;
      };
      const text = body.text?.trim() || demoRestaurantContext.greeting;
      const preview = await createOpenAIVoicePreview({
        env: currentEnv,
        text,
        voiceGender: body.voiceGender,
        voiceProfileId: body.voiceProfileId,
      });

      res.writeHead(200, {
        "Content-Type": preview.contentType,
        "Cache-Control": "no-store",
      });
      res.end(preview.audio);
    } catch (error) {
      sendCaughtError(res, error, "Voice preview failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/web-chat/message") {
    if (!(await allowRateLimitedRequest(req, res, "web-chat", 60, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, WEB_CHAT_BODY_LIMIT_BYTES)) as WebChatMessageInput;
      const result = await webChatService.handleMessage(body);
      sendJson(res, 200, result);
    } catch (error) {
      sendCaughtError(res, error, "Web chat message failed");
    }
    return;
  }

  if (req.method === "POST" && (url.pathname === "/owner/email-command" || url.pathname === "/email/owner-command")) {
    if (!(await allowRateLimitedRequest(req, res, "owner-email-command", 60, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, OWNER_EMAIL_BODY_LIMIT_BYTES)) as OwnerEmailCommandInput;
      const locationId = body.locationId?.trim() || url.searchParams.get("locationId") || undefined;
      const authorization = await authorizeVoiceAdminRequest({
        currentEnv,
        locationId,
        req,
      });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const result = await ownerEmailCommandService.handleInboundEmail({
        ...body,
        locationId: locationId ?? body.locationId,
      });

      const statusCode = result.status === "processed"
        ? 200
        : result.status === "ambiguous"
          ? 409
          : result.status === "not_found"
            ? 404
            : 400;
      sendJson(res, statusCode, result);
    } catch (error) {
      sendCaughtError(res, error, "Owner email command failed");
    }
    return;
  }

  if (req.method === "POST" && (url.pathname === "/resend/inbound-email" || url.pathname === "/email/resend-inbound")) {
    if (!(await allowRateLimitedRequest(req, res, "resend-inbound-email", 120, currentEnv))) return;

    try {
      const result = await resendInboundEmailService.handleWebhook({
        headers: req.headers,
        rawBody: await readLimitedRequestBody(req, RESEND_INBOUND_BODY_LIMIT_BYTES),
      });
      sendJson(res, 200, result);
    } catch (error) {
      if (error instanceof Error && /resend webhook|signature|timestamp/i.test(error.message)) {
        sendJson(res, 401, { error: error.message });
        return;
      }
      sendCaughtError(res, error, "Resend inbound email failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/agent/test-reply") {
    if (!(await allowRateLimitedRequest(req, res, "agent-test-reply", 45, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as AgentTestReplyInput;
      const locationId = body.locationId?.trim() || url.searchParams.get("locationId") || currentEnv.SUPABASE_DEMO_LOCATION_ID;
      const authorization = await authorizeVoiceAdminRequest({
        currentEnv,
        locationId,
        req,
      });
      if (!authorization.authorized) {
        sendJson(res, authorization.status, { error: authorization.reason ?? "Unauthorized" });
        return;
      }

      const restaurantContext = await restaurantContextStore.getContext(locationId ?? undefined);
      const result = await generateAgentTestReply({
        context: restaurantContext,
        env: currentEnv,
        input: {
          ...body,
          locationId: locationId ?? body.locationId,
        },
      });
      sendJson(res, 200, result);
    } catch (error) {
      sendCaughtError(res, error, "Agent test reply failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/debug/reply" && currentEnv.NODE_ENV !== "production") {
    if (!(await allowRateLimitedRequest(req, res, "debug-reply", 30, currentEnv))) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        locationId?: string;
        prompt?: string;
      };
      const restaurantContext = await restaurantContextStore.getContext(body.locationId);
      const reply = await generateRestaurantReply({
        callerUtterance: body.prompt ?? "",
        context: restaurantContext,
        env: currentEnv,
        transcript: [],
      });
      sendJson(res, 200, { reply });
    } catch (error) {
      sendCaughtError(res, error, "Debug reply failed");
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

function isValidTwilioWebhook(req: IncomingMessage, currentEnv: VoiceServiceEnv, params: Record<string, string>) {
  if (!currentEnv.REQUIRE_TWILIO_SIGNATURE) return true;
  if (!currentEnv.TWILIO_AUTH_TOKEN || !currentEnv.PUBLIC_HTTP_BASE_URL) return false;

  return validateTwilioSignature({
    authToken: currentEnv.TWILIO_AUTH_TOKEN,
    expectedSignature: req.headers["x-twilio-signature"],
    params,
    url: `${currentEnv.PUBLIC_HTTP_BASE_URL.replace(/\/$/, "")}${req.url ?? ""}`,
  });
}

function isValidTwilioUpgrade(req: IncomingMessage, currentEnv: VoiceServiceEnv) {
  if (!isAllowedUpgradeOrigin(req, currentEnv)) return false;
  if (!currentEnv.REQUIRE_TWILIO_SIGNATURE) return true;
  if (!currentEnv.TWILIO_AUTH_TOKEN || !currentEnv.PUBLIC_WS_BASE_URL) return false;

  return validateTwilioSignature({
    authToken: currentEnv.TWILIO_AUTH_TOKEN,
    expectedSignature: req.headers["x-twilio-signature"],
    url: `${currentEnv.PUBLIC_WS_BASE_URL.replace(/\/$/, "")}${req.url ?? ""}`,
  });
}

function isAllowedUpgradeOrigin(req: IncomingMessage, currentEnv: VoiceServiceEnv) {
  const origin = firstHeader(req.headers.origin);
  if (!origin) return true;
  const allowedOrigin = currentEnv.VOICE_SERVICE_ALLOWED_ORIGIN;
  return allowedOrigin === "*" || allowedOrigin.split(",").map((item) => item.trim()).includes(origin);
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function sendPrometheus(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" });
  res.end(body);
}

function sendXml(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, { "Content-Type": "application/xml" });
  res.end(body);
}

function sendText(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, { "Content-Type": "text/plain" });
  res.end(body);
}

function withQueryParam(url: string, key: string, value: string) {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set(key, value);
  return nextUrl.toString();
}

function withOptionalQueryParams(url: string | undefined, params: Record<string, string | undefined>) {
  if (!url) return undefined;

  let nextUrl = url;
  for (const [key, value] of Object.entries(params)) {
    if (value) nextUrl = withQueryParam(nextUrl, key, value);
  }
  return nextUrl;
}

function buildRelayCustomParameters(
  params: Record<string, string>,
  locationId: string,
  callSessionKey = getStableCallSessionKey(params),
) {
  return {
    callSessionKey,
    callerPhone: firstNonEmpty(params.From, params.from),
    dialedPhone: firstNonEmpty(params.To, params.to),
    locationId,
  };
}

function getStableCallSessionKey(params: Record<string, string>, fallback?: string) {
  return firstNonEmpty(params.CallSid, params.callSid, params.ParentCallSid, params.parentCallSid, fallback);
}

function firstNonEmpty(...values: Array<string | undefined | null>) {
  return values.find((value) => value?.trim())?.trim();
}

function summarizeSipTarget(twiml: string) {
  return twiml.match(/<Sip\b[^>]*>(.*?)<\/Sip>/s)?.[1]?.trim();
}

function scheduleLiveKitCallRecordingStart({ callSid, locationId }: { callSid?: string; locationId: string }) {
  if (!callSid || !callRecordingService.configured) return;
  LIVEKIT_RECORDING_START_DELAYS_MS.forEach((delayMs, index) => {
    const timer = setTimeout(() => {
      void callRecordingService.startCallRecording({
        externalCallSid: callSid,
        locationId,
      }).then((result) => {
        if (result.started) {
          console.info("[voice-service] LiveKit Twilio call recording started", {
            attempt: index + 1,
            callSid,
            delayMs,
            locationId,
            recordingSid: result.recordingSid,
          });
        } else if (!result.skipped) {
          console.warn("[voice-service] LiveKit Twilio call recording did not start", {
            attempt: index + 1,
            callSid,
            delayMs,
            locationId,
          });
        }
      }).catch((error) => {
        console.warn("[voice-service] LiveKit Twilio call recording start failed", {
          attempt: index + 1,
          callSid,
          delayMs,
          error,
          locationId,
        });
      });
    }, delayMs);
    timer.unref?.();
  });
}

interface CallDebugRow {
  caller_phone: string | null;
  duration_seconds: number | null;
  external_call_sid: string | null;
  external_session_id: string | null;
  id: string;
  intent: string | null;
  location_id: string;
  outcome: string | null;
  recording_url: string | null;
  started_at: string;
  status: string | null;
  summary: string | null;
  twilio_payload: unknown;
}

interface TranscriptDebugRow {
  created_at: string;
  offset_seconds: number;
  speaker: string;
  text: string;
}

const CALL_DEBUG_SELECT =
  "select=id,location_id,external_call_sid,external_session_id,caller_phone,started_at,duration_seconds,intent,outcome,status,summary,recording_url,twilio_payload";

async function buildCallDebugPack({
  callId,
  currentEnv,
  includeAudio,
  locationId,
}: {
  callId?: string;
  currentEnv: VoiceServiceEnv;
  includeAudio: boolean;
  locationId?: string;
}) {
  if (!currentEnv.SUPABASE_URL || !currentEnv.SUPABASE_SECRET_KEY) {
    throw new HttpRequestError(503, "Supabase service credentials are not configured.");
  }
  if (!locationId) {
    throw new HttpRequestError(400, "locationId is required.");
  }

  const callQuery = callId
    ? `calls?id=eq.${encodeURIComponent(callId)}&location_id=eq.${encodeURIComponent(locationId)}&${CALL_DEBUG_SELECT}`
    : `calls?location_id=eq.${encodeURIComponent(locationId)}&${CALL_DEBUG_SELECT}&order=started_at.desc&limit=1`;
  const calls = await supabaseServiceRequest<CallDebugRow[]>(currentEnv, callQuery);
  const call = calls[0];
  if (!call) {
    throw new HttpRequestError(404, "No matching call found.");
  }

  const transcriptTurns = await supabaseServiceRequest<TranscriptDebugRow[]>(
    currentEnv,
    `transcript_turns?call_id=eq.${encodeURIComponent(call.id)}&select=speaker,text,offset_seconds,created_at&order=created_at.asc`,
  );
  const callPath = resolveCallDebugPath(call);
  const observations = buildCallDebugObservations(call, transcriptTurns, callPath);
  const audioDiagnostic = includeAudio
    ? await runOpenAIAudioDiagnostic({
      currentEnv,
      recordingUrl: call.recording_url,
    })
    : {
      reason: "Pass audio=true to run a second-pass OpenAI transcription of the recording.",
      skipped: true,
    };

  return {
    audioDiagnostic,
    call,
    callPath,
    observations,
    transcriptTurns,
  };
}

async function supabaseServiceRequest<T>(currentEnv: VoiceServiceEnv, path: string): Promise<T> {
  const response = await fetch(`${currentEnv.SUPABASE_URL?.replace(/\/$/, "")}/rest/v1/${path}`, {
    headers: buildSupabaseServiceHeaders(currentEnv.SUPABASE_SECRET_KEY ?? ""),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new HttpRequestError(response.status, `Supabase request failed: ${text}`);
  }
  return (text ? JSON.parse(text) : []) as T;
}

function buildCallDebugObservations(call: CallDebugRow, transcriptTurns: TranscriptDebugRow[], callPath: string) {
  const summary = call.summary ?? "";
  const speechStartCount = numberFromSummary(summary, /speech starts (\d+)/i);
  const speechStopCount = numberFromSummary(summary, /speech stops (\d+)/i);
  const callerTurnCount = transcriptTurns.filter((turn) => turn.speaker === "caller").length;
  const agentTurnCount = transcriptTurns.filter((turn) => turn.speaker === "agent").length;
  const ignoredNoise = summary.match(/Ignored likely background:\s*(.+?)(?:\. Call close:|$)/i)?.[1];
  const firstResponseMs = numberFromSummary(summary, /First post-caller response started after (\d+)ms/i);
  const greetingMs = numberFromSummary(summary, /Greeting response started after (\d+)ms/i);
  const notes = [
    speechStartCount !== undefined && speechStartCount > callerTurnCount
      ? `Realtime detected ${speechStartCount} speech starts but only ${callerTurnCount} caller transcript turns; false speech starts or echo may have interrupted audio.`
      : undefined,
    ignoredNoise ? `Ignored likely background transcript: ${ignoredNoise}` : undefined,
    `Call path: ${callPath}.`,
    callPath === "livekit_agent"
      ? "This call hit the experimental LiveKit agent path, not the primary OpenAI Realtime SIP path."
      : undefined,
    callPath === "twilio_conversation_relay"
      ? "This call hit the legacy Twilio ConversationRelay path, not the primary OpenAI Realtime SIP path."
      : undefined,
    greetingMs !== undefined ? `Greeting began after ${greetingMs}ms.` : undefined,
    firstResponseMs !== undefined ? `First post-caller response began ${firstResponseMs}ms after caller speech stopped.` : undefined,
    !call.recording_url ? "No recording URL is attached to this call." : undefined,
  ].filter((note): note is string => Boolean(note));

  return {
    agentTurnCount,
    callerTurnCount,
    firstResponseMs,
    greetingMs,
    ignoredNoise,
    notes,
    speechStartCount,
    speechStopCount,
  };
}

function resolveCallDebugPath(call: CallDebugRow) {
  const payload = isRecord(call.twilio_payload) ? call.twilio_payload : {};
  const provider = stringValue(payload.provider) ?? stringValue(payload.realtimeAcceptProvider);
  if (provider) return provider;
  if (call.external_call_sid?.startsWith("harbor-call-")) return "livekit_agent";
  if (call.summary?.includes("Realtime quality:")) return "openai_realtime_sip";
  if (call.external_call_sid?.startsWith("CA")) return "twilio_conversation_relay";
  return "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberFromSummary(summary: string, pattern: RegExp) {
  const value = summary.match(pattern)?.[1];
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function runOpenAIAudioDiagnostic({
  currentEnv,
  recordingUrl,
}: {
  currentEnv: VoiceServiceEnv;
  recordingUrl?: string | null;
}) {
  if (!recordingUrl) {
    return { reason: "No recording URL is attached to this call.", skipped: true };
  }
  if (!currentEnv.OPENAI_API_KEY) {
    return { reason: "OPENAI_API_KEY is not configured.", skipped: true };
  }

  const audioResponse = await fetch(recordingUrl);
  if (!audioResponse.ok) {
    return {
      error: await audioResponse.text(),
      recordingStatus: audioResponse.status,
      skipped: true,
    };
  }

  const contentLength = Number.parseInt(audioResponse.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(contentLength) && contentLength > CALL_DEBUG_AUDIO_LIMIT_BYTES) {
    return {
      reason: `Recording is too large for inline diagnostics (${contentLength} bytes).`,
      skipped: true,
    };
  }

  const audioBytes = new Uint8Array(await audioResponse.arrayBuffer());
  if (audioBytes.byteLength > CALL_DEBUG_AUDIO_LIMIT_BYTES) {
    return {
      reason: `Recording is too large for inline diagnostics (${audioBytes.byteLength} bytes).`,
      skipped: true,
    };
  }

  const model = currentEnv.OPENAI_AUDIO_DIAGNOSTIC_MODEL?.trim() || "gpt-4o-transcribe-diarize";
  const form = new FormData();
  form.set("model", model);
  form.set("file", new Blob([audioBytes], { type: "audio/mpeg" }), "call.mp3");
  if (/diarize/i.test(model)) {
    form.set("chunking_strategy", "auto");
    form.set("response_format", "diarized_json");
  } else {
    form.set("response_format", "json");
  }

  const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    body: form,
    headers: {
      Authorization: `Bearer ${currentEnv.OPENAI_API_KEY}`,
    },
    method: "POST",
  });
  const text = await transcriptionResponse.text();
  if (!transcriptionResponse.ok) {
    return {
      error: text,
      model,
      skipped: true,
      transcriptionStatus: transcriptionResponse.status,
    };
  }

  return {
    model,
    result: text ? JSON.parse(text) : {},
    skipped: false,
  };
}

function isTruthyQueryParam(value?: string | null) {
  return /^(1|true|yes)$/i.test(value?.trim() ?? "");
}

async function streamTwilioRecordingPlayback({
  currentEnv,
  recordingSid,
  res,
  token,
}: {
  currentEnv: VoiceServiceEnv;
  recordingSid: string;
  res: ServerResponse;
  token?: string | null;
}) {
  if (!/^RE[a-f0-9]{32}$/i.test(recordingSid)) {
    sendJson(res, 400, { error: "Invalid recording id." });
    return;
  }
  if (!validateRecordingPlaybackToken({
    expectedToken: token,
    recordingSid,
    signingSecret: currentEnv.TWILIO_AUTH_TOKEN,
  })) {
    sendJson(res, 401, { error: "Invalid recording token." });
    return;
  }
  if (!currentEnv.TWILIO_ACCOUNT_SID || !currentEnv.TWILIO_AUTH_TOKEN) {
    sendJson(res, 503, { error: "Twilio credentials are not configured." });
    return;
  }

  const recordingUrl = buildTwilioRecordingMediaUrl({
    accountSid: currentEnv.TWILIO_ACCOUNT_SID,
    baseUrl: currentEnv.TWILIO_API_BASE_URL,
    recordingSid,
  });
  if (!recordingUrl) {
    sendJson(res, 404, { error: "Recording not found." });
    return;
  }

  const response = await fetch(recordingUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${currentEnv.TWILIO_ACCOUNT_SID}:${currentEnv.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
    },
  });
  if (!response.ok) {
    sendJson(res, response.status === 404 ? 404 : 502, { error: "Recording media is not available yet." });
    return;
  }

  const body = Buffer.from(await response.arrayBuffer());
  res.writeHead(200, {
    "Cache-Control": "private, max-age=300",
    "Content-Length": String(body.byteLength),
    "Content-Type": response.headers.get("content-type") ?? "audio/mpeg",
  });
  res.end(body);
}

function normalizeRecordingUrl(value?: string) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /\.(?:mp3|wav)$/i.test(trimmed) ? trimmed : `${trimmed}.mp3`;
}

function parseOptionalSeconds(value?: string) {
  if (!value) return undefined;
  const seconds = Number.parseInt(value, 10);
  return Number.isFinite(seconds) ? seconds : undefined;
}

function parseConversationRelayHandoffData(value?: string) {
  if (!value) return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, string>
      : {} as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

function isCompletedTwilioCall(params: Record<string, string>) {
  const callStatus = firstNonEmpty(params.CallStatus, params.callStatus)?.toLowerCase();
  return callStatus === "completed" || callStatus === "busy" || callStatus === "failed" || callStatus === "no-answer";
}

async function reconcileConversationRelayEndedCallback(
  params: Record<string, string>,
  handoffData: Record<string, string>,
) {
  const externalCallSid = firstNonEmpty(params.CallSid, params.callSid, params.ParentCallSid, params.parentCallSid);
  const durationSeconds = parseOptionalSeconds(
    firstNonEmpty(params.CallDuration, params.callDuration, params.Duration, params.duration),
  );
  if (!externalCallSid || durationSeconds === undefined) return;

  const callStatus = firstNonEmpty(params.CallStatus, params.callStatus)?.toLowerCase();
  const reasonCode = handoffData.reasonCode;
  const resolved = callStatus === "completed" || reasonCode === "natural_goodbye";
  await callStore.completeCall({
    durationSeconds,
    externalCallSid,
    outcome: reasonCode ? `twilio_${reasonCode}` : callStatus ? `twilio_${callStatus}` : "twilio_conversation_ended",
    status: resolved ? "resolved" : "needs_review",
  });
}

async function allowRateLimitedRequest(
  req: IncomingMessage,
  res: ServerResponse,
  action: string,
  limit: number,
  currentEnv: VoiceServiceEnv,
) {
  const result = await checkDistributedRateLimit({
    key: `${action}:${getRequestIp(req)}`,
    limit,
    redisRestToken: currentEnv.RATE_LIMIT_REDIS_REST_TOKEN,
    redisRestUrl: currentEnv.RATE_LIMIT_REDIS_REST_URL,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  if (result.allowed) return true;

  res.setHeader("Retry-After", String(result.retryAfterSeconds));
  sendJson(res, 429, {
    error: "Too many requests. Please wait a moment and try again.",
    retryAfterSeconds: result.retryAfterSeconds,
  });
  return false;
}

function sendCaughtError(res: ServerResponse, error: unknown, fallbackMessage: string) {
  if (error instanceof HttpRequestError) {
    sendJson(res, error.statusCode, { error: error.message });
    return;
  }

  console.error("[voice-service] request failed", error);
  sendJson(res, 500, { error: fallbackMessage });
}

async function findFirstAvailablePhoneNumber(input: {
  areaCode?: string;
  contains?: string;
  country?: string;
}) {
  const numbers = await telephonyService.searchAvailableNumbers({
    areaCode: input.areaCode,
    contains: input.contains,
    country: input.country,
    limit: 1,
  });
  return numbers[0]?.phoneNumber;
}

function normalizeAttachedPhoneNumber(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed;
}

function isValidInternalRequest(req: IncomingMessage, currentEnv: VoiceServiceEnv) {
  const expected = currentEnv.SIGNALHOST_INTERNAL_API_KEY || currentEnv.HOSTLINE_INTERNAL_API_KEY;
  if (!expected) return false;

  const apiKey = firstHeader(req.headers["x-signalhost-api-key"]) ??
    firstHeader(req.headers["x-hostline-api-key"]) ??
    bearerToken(firstHeader(req.headers.authorization));
  return apiKey === expected;
}

function bearerToken(value?: string) {
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function firstHeader(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function applyCors(req: IncomingMessage, res: ServerResponse, currentEnv: VoiceServiceEnv) {
  const origin = req.headers.origin;
  const allowedOrigin = currentEnv.VOICE_SERVICE_ALLOWED_ORIGIN;

  if (allowedOrigin === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && allowedOrigin.split(",").map((item) => item.trim()).includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, stripe-signature, webhook-id, webhook-signature, webhook-timestamp, x-signalhost-api-key, x-hostline-api-key");
}

async function shutdownGracefully(signal: "SIGINT" | "SIGTERM") {
  console.info("[voice-service] graceful shutdown requested", {
    activeRelayConnections: activeRelaySockets.size,
    signal,
  });

  server.close((error) => {
    if (error) {
      console.error("[voice-service] server close failed", error);
      process.exitCode = 1;
    }
  });

  for (const ws of activeRelaySockets) {
    try {
      ws.close(1001, "SignalHost voice service is restarting.");
    } catch (error) {
      console.warn("[voice-service] websocket close failed", error);
    }
  }

  await waitForRelaySocketsToClose(4500);
  await waitForRelayCompletions(4500);
  openAIRealtimeSipService.closeAll();
  wss.close();

  for (const ws of activeRelaySockets) {
    try {
      ws.terminate();
    } catch (error) {
      console.warn("[voice-service] websocket terminate failed", error);
    }
  }
}

function trackRelayCompletion(completion: Promise<void>) {
  const tracked = completion.finally(() => activeRelayCompletions.delete(tracked));
  activeRelayCompletions.add(tracked);
}

function waitForRelaySocketsToClose(timeoutMs: number) {
  const startedAt = Date.now();

  return new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      if (!activeRelaySockets.size || Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });
}

async function waitForRelayCompletions(timeoutMs: number) {
  if (!activeRelayCompletions.size) return;

  await Promise.race([
    Promise.allSettled(Array.from(activeRelayCompletions)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
