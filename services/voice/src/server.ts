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
  checkRateLimit,
  getRequestIp,
  HttpRequestError,
  parseJsonRequestBody,
  readLimitedRequestBody,
} from "./http-safety";
import { createMenuIngestionService } from "./menu-ingestion-service";
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
import { createTwilioCallRecordingService } from "./twilio-recording-service";
import { demoRestaurantContext } from "./restaurant-context";
import { generateRestaurantReply } from "./restaurant-agent";
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
const OPENAI_WEBHOOK_BODY_LIMIT_BYTES = 32 * 1024;
const OWNER_EMAIL_BODY_LIMIT_BYTES = 64 * 1024;
const PREVIEW_BODY_LIMIT_BYTES = 4 * 1024;
const RESEND_INBOUND_BODY_LIMIT_BYTES = 128 * 1024;
const TENANT_BOOTSTRAP_BODY_LIMIT_BYTES = 64 * 1024;
const TWILIO_BODY_LIMIT_BYTES = 16 * 1024;
const WEB_CHAT_BODY_LIMIT_BYTES = 16 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const server = createServer((req, res) => {
  void handleRequest(req, res, env);
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
      openAIRealtimeSipConfigured: openAIRealtimeSipService.configured,
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

  if (req.method === "POST" && url.pathname === "/tenant/bootstrap") {
    if (!allowRateLimitedRequest(req, res, "tenant-bootstrap", 20)) return;

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
    if (!allowRateLimitedRequest(req, res, "billing-checkout", 20)) return;

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
    if (!allowRateLimitedRequest(req, res, "billing-portal", 20)) return;

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
    if (!allowRateLimitedRequest(req, res, "owner-daily-report", 20)) return;

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
    if (!allowRateLimitedRequest(req, res, "owner-daily-report-deliver", 10)) return;

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
    if (!allowRateLimitedRequest(req, res, "customer-follow-up-send", 30)) return;

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

  if (req.method === "POST" && url.pathname === "/ingestion/run-next") {
    if (!allowRateLimitedRequest(req, res, "ingestion", 20)) return;

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
    if (!allowRateLimitedRequest(req, res, "number-search", 45)) return;

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
    if (!allowRateLimitedRequest(req, res, "number-provision", 10)) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        areaCode?: string;
        contains?: string;
        country?: string;
        forwardingMode?: string;
        locationId?: string;
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
      if (!guard.allowed) {
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
        phoneNumber: selectedPhoneNumber,
        restaurantMainLine: body.restaurantMainLine,
        trialDays: body.trialDays,
        trialGraceDays: body.trialGraceDays,
      };
      const provisioned = await telephonyService.provisionPhoneNumber(input);
      await phoneNumberStore.saveProvisionedNumber(input, provisioned);
      sendJson(res, 200, { phoneNumber: provisioned });
    } catch (error) {
      sendCaughtError(res, error, "Twilio number provisioning failed");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/telephony/attach-number") {
    if (!allowRateLimitedRequest(req, res, "number-attach", 20)) return;

    try {
      const body = parseJsonRequestBody(await readLimitedRequestBody(req, ADMIN_BODY_LIMIT_BYTES)) as {
        capabilities?: Record<string, boolean>;
        forwardingMode?: string;
        locationId?: string;
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
      if (!guard.allowed && guard.existingPhoneNumber !== phoneNumber) {
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

  if (req.method === "POST" && url.pathname === "/telephony/release-number") {
    if (!allowRateLimitedRequest(req, res, "number-release", 20)) return;

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

  if (req.method === "POST" && url.pathname === "/twilio/voice") {
    try {
      const rawBody = await readLimitedRequestBody(req, TWILIO_BODY_LIMIT_BYTES);
      const params = Object.fromEntries(new URLSearchParams(rawBody));

      if (!isValidTwilioWebhook(req, currentEnv, params)) {
        sendText(res, 401, "Invalid Twilio signature");
        return;
      }

      if (!currentEnv.PUBLIC_WS_BASE_URL) {
        sendXml(res, 503, buildUnavailableTwiML());
        return;
      }

      const locationId =
        params.locationId ??
        url.searchParams.get("locationId") ??
        currentEnv.SUPABASE_DEMO_LOCATION_ID ??
        "demo-location";
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

      const recordingUrl = normalizeRecordingUrl(firstNonEmpty(params.RecordingUrl, params.recordingUrl));
      const externalCallSid = firstNonEmpty(
        params.CallSid,
        params.callSid,
        params.ParentCallSid,
        params.parentCallSid,
        url.searchParams.get("externalCallSid"),
      );
      const callRecordId = firstNonEmpty(params.callRecordId, params.CallRecordId, url.searchParams.get("callRecordId"));
      if (!recordingUrl || !externalCallSid) {
        sendJson(res, 400, { error: "RecordingUrl and CallSid are required." });
        return;
      }

      await callStore.attachCallRecording({
        callId: callRecordId,
        durationSeconds: parseOptionalSeconds(firstNonEmpty(params.RecordingDuration, params.recordingDuration)),
        externalCallSid,
        providerPayload: params,
        recordingSid: firstNonEmpty(params.RecordingSid, params.recordingSid),
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
    if (!allowRateLimitedRequest(req, res, "voice-preview", 20)) return;

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
    if (!allowRateLimitedRequest(req, res, "web-chat", 60)) return;

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
    if (!allowRateLimitedRequest(req, res, "owner-email-command", 60)) return;

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
    if (!allowRateLimitedRequest(req, res, "resend-inbound-email", 120)) return;

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
    if (!allowRateLimitedRequest(req, res, "agent-test-reply", 45)) return;

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
    if (!allowRateLimitedRequest(req, res, "debug-reply", 30)) return;

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
    url: `${currentEnv.PUBLIC_HTTP_BASE_URL}${req.url ?? ""}`,
  });
}

function isValidTwilioUpgrade(req: IncomingMessage, currentEnv: VoiceServiceEnv) {
  if (!currentEnv.REQUIRE_TWILIO_SIGNATURE) return true;
  if (!currentEnv.TWILIO_AUTH_TOKEN || !currentEnv.PUBLIC_WS_BASE_URL) return false;

  return validateTwilioSignature({
    authToken: currentEnv.TWILIO_AUTH_TOKEN,
    expectedSignature: req.headers["x-twilio-signature"],
    url: `${currentEnv.PUBLIC_WS_BASE_URL}${req.url ?? ""}`,
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
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

function allowRateLimitedRequest(req: IncomingMessage, res: ServerResponse, action: string, limit: number) {
  const result = checkRateLimit({
    key: `${action}:${getRequestIp(req)}`,
    limit,
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
