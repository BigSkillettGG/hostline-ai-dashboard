import type { BusinessTemplate } from "./business-templates";
import { assignedDemoPhoneNumber, type OnboardingDraft } from "./onboarding";

export type PhoneLineType = "landline" | "mobile" | "unknown" | "voip";

export interface LaunchInstructionBlock {
  body: string;
  steps: string[];
  title: string;
}

export interface PostInterviewLaunchGuide {
  firstTestScenarios: string[];
  launchPacketText: string;
  ownerOperatingRules: LaunchInstructionBlock;
  phoneForwarding: LaunchInstructionBlock & {
    providerScript: string;
    setupLabel: string;
  };
  readinessWarnings: string[];
  websiteChat: LaunchInstructionBlock & {
    handoffText: string;
    snippet: string;
  };
}

export function buildPostInterviewLaunchGuide(input: {
  appBaseUrl?: string;
  assignedNumber: string;
  businessName: string;
  draft: OnboardingDraft;
  locationId?: string;
  template: BusinessTemplate;
  voiceServiceUrl?: string;
}): PostInterviewLaunchGuide {
  const phoneForwarding = buildPhoneForwardingGuide(input.draft, input.assignedNumber, input.template);
  const websiteChat = buildWebsiteChatGuide({
    appBaseUrl: input.appBaseUrl,
    businessName: input.businessName,
    draft: input.draft,
    locationId: input.locationId,
    template: input.template,
    voiceServiceUrl: input.voiceServiceUrl,
  });
  const ownerOperatingRules = buildOwnerOperatingRules(input.template);
  const firstTestScenarios = buildFirstTestScenarios(input.template, input.draft);
  const readinessWarnings = buildReadinessWarnings(input.draft, input.assignedNumber);

  return {
    firstTestScenarios,
    launchPacketText: buildLaunchPacketText({
      businessName: input.businessName,
      firstTestScenarios,
      ownerOperatingRules,
      phoneForwarding,
      template: input.template,
      websiteChat,
    }),
    ownerOperatingRules,
    phoneForwarding,
    readinessWarnings,
    websiteChat,
  };
}

export function buildWebsiteChatSnippet(input: {
  appBaseUrl?: string;
  businessName: string;
  locationId?: string;
  template: BusinessTemplate;
  voiceServiceUrl?: string;
}) {
  const appBaseUrl = normalizeBaseUrl(input.appBaseUrl) || "https://signalhost.ai";
  const voiceServiceUrl = normalizeBaseUrl(input.voiceServiceUrl) || "https://voice.signalhost.ai";
  const prompts = websitePromptsForVertical(input.template).join("|");

  return `<script
  src="${appBaseUrl}/signalhost-chat.js"
  data-location-id="${escapeHtmlAttribute(input.locationId || "YOUR_LOCATION_ID")}"
  data-title="${escapeHtmlAttribute(input.businessName)}"
  data-subtitle="Answers right away"
  data-voice-service-url="${voiceServiceUrl}"
  data-primary-color="#211713"
  data-accent-color="#d84824"
  data-prompts="${escapeHtmlAttribute(prompts)}"
  async
></script>`;
}

export function normalizePhoneLineType(value: unknown): PhoneLineType {
  if (typeof value !== "string") return "unknown";
  const normalized = value.toLowerCase();
  if (normalized.includes("mobile") || normalized.includes("cell")) return "mobile";
  if (normalized.includes("landline") || normalized.includes("desk")) return "landline";
  if (normalized.includes("voip") || normalized.includes("pbx") || normalized.includes("ringcentral") || normalized.includes("google voice")) {
    return "voip";
  }
  return "unknown";
}

function buildPhoneForwardingGuide(
  draft: OnboardingDraft,
  assignedNumber: string,
  template: BusinessTemplate,
): PostInterviewLaunchGuide["phoneForwarding"] {
  const lineType = normalizePhoneLineType(draft.phoneLineType);
  const forwardingMode = String(draft.forwardingMode || "Forward only unanswered calls");
  const provider = String(draft.phoneProvider || "").trim();
  const mainPhone = String(draft.mainPhone || "your current business number").trim();
  const modeLabel = forwardingMode.toLowerCase();
  const providerText = provider ? ` with ${provider}` : "";

  if (lineType === "mobile") {
    return {
      body:
        "Use this when the business line is a mobile phone. The safest first setup is unanswered or busy forwarding if the carrier offers it; all-call forwarding is fine for a short test.",
      providerScript: buildProviderScript({ assignedNumber, forwardingMode, mainPhone, provider, template }),
      setupLabel: provider ? `Mobile phone${providerText}` : "Mobile phone",
      steps: [
        "Use the mobile phone that currently receives customer calls.",
        "Open the phone or carrier settings and look for Call Forwarding, Conditional Call Forwarding, Unanswered Forwarding, or Busy Forwarding.",
        `Enter ${assignedNumber} as the forwarding destination.`,
        "Save the change, then call the current business number from a different phone.",
        "Let it ring unanswered, then test again while the business phone is already on another call.",
      ],
      title: `Set ${modeLabel} from the mobile line`,
    };
  }

  if (lineType === "voip") {
    return {
      body:
        "Use this when the business phone is managed through a VoIP dashboard, hosted PBX, ring group, or internet phone provider.",
      providerScript: buildProviderScript({ assignedNumber, forwardingMode, mainPhone, provider, template }),
      setupLabel: provider ? `VoIP or phone system${providerText}` : "VoIP or phone system",
      steps: [
        "Open the phone-system admin portal or ask the phone administrator to help.",
        "Find call handling, ring groups, failover, business-hours routing, or unanswered/busy forwarding.",
        `Set unanswered and busy calls from ${mainPhone} to forward to ${assignedNumber}.`,
        "Keep normal staff phones ringing first if SignalHost should only catch overflow.",
        "Run the direct, unanswered, and busy-line tests before sending real customer traffic.",
      ],
      title: `Route ${modeLabel} in the phone system`,
    };
  }

  if (lineType === "landline") {
    return {
      body:
        "Use this when the business line is an old-school landline, cable phone line, or phone plugged into the wall. The carrier may need to turn on busy and no-answer forwarding.",
      providerScript: buildProviderScript({ assignedNumber, forwardingMode, mainPhone, provider, template }),
      setupLabel: provider ? `Landline${providerText}` : "Landline",
      steps: [
        "Call the phone provider or sign in to the provider account.",
        "Ask for no-answer forwarding and busy-line forwarding, sometimes called conditional call forwarding.",
        `Tell them to forward to ${assignedNumber} after 3 to 4 rings and whenever the line is busy.`,
        "Confirm voicemail does not pick up before SignalHost gets the call.",
        "Run the direct, unanswered, and busy-line tests from a separate phone.",
      ],
      title: `Ask the carrier to set ${modeLabel}`,
    };
  }

  return {
    body:
      "Use this when the owner is not sure what kind of phone system they have. The instruction below is written so they can send it to whoever manages the phone line.",
    providerScript: buildProviderScript({ assignedNumber, forwardingMode, mainPhone, provider, template }),
    setupLabel: "Phone setup type not sure yet",
    steps: [
      "Find out who manages the current business phone number: mobile carrier, landline provider, VoIP provider, or website/IT person.",
      `Ask them to forward calls from ${mainPhone} to ${assignedNumber} based on the selected mode.`,
      "Use no-answer and busy-line forwarding if SignalHost should catch missed or overflow calls.",
      "Use all-call forwarding only when SignalHost should answer before staff phones ring.",
      "Run a direct call test, then an unanswered call test, then a busy-line test.",
    ],
    title: `Set ${modeLabel} to SignalHost`,
  };
}

function buildWebsiteChatGuide(input: {
  appBaseUrl?: string;
  businessName: string;
  draft: OnboardingDraft;
  locationId?: string;
  template: BusinessTemplate;
  voiceServiceUrl?: string;
}): PostInterviewLaunchGuide["websiteChat"] {
  const platform = String(input.draft.websitePlatform || "Not sure").trim();
  const websiteUrl = String(input.draft.websiteUrl || "").trim();
  const contact = String(input.draft.websiteAdminContact || "").trim();
  const snippet = buildWebsiteChatSnippet(input);

  return {
    body: websiteUrl
      ? `Install the chat widget on ${websiteUrl}. It uses the same knowledge, links, and escalation rules as the phone agent.`
      : "Install the chat widget on the business website. It uses the same knowledge, links, and escalation rules as the phone agent.",
    handoffText: buildWebsiteHandoffText({
      businessName: input.businessName,
      contact,
      platform,
      snippet,
      websiteUrl,
    }),
    snippet,
    steps: websiteInstallSteps(platform),
    title: platform && platform !== "Not sure" ? `Add website chat to ${platform}` : "Add website chat to the website",
  };
}

function buildOwnerOperatingRules(template: BusinessTemplate): LaunchInstructionBlock {
  const appointmentText = template.id === "restaurant" ? "reservation, order, event, or guest issue" : `${template.appointmentNoun}, request, estimate, or customer issue`;

  return {
    body:
      "After launch, the owner should treat SignalHost like a new front-desk employee: review the first calls, correct missing answers, and add temporary updates before busy periods.",
    steps: [
      "Use Ask SignalHost to ask what happened today, what needs follow-up, and what the AI did not know.",
      "Add temporary updates for closures, specials, staffing changes, weather, promotions, or limited availability.",
      `Review every important ${appointmentText} in Tasks until the workflow feels reliable.`,
      "When SignalHost misses an answer, save the correction as a knowledge suggestion before marking it resolved.",
      "Check the daily brief for urgent items, high-value opportunities, unanswered questions, and suggested updates.",
    ],
    title: "How to work with SignalHost after launch",
  };
}

function buildFirstTestScenarios(template: BusinessTemplate, draft: OnboardingDraft) {
  const custom = String(draft.firstTestCall || "").trim();
  if (custom) {
    return custom
      .split(/[\n.]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  if (template.id === "restaurant") {
    return [
      "Ask if the business is open tonight.",
      "Ask about parking and directions.",
      "Ask about an allergy or dietary restriction.",
      "Ask for a reservation or booking link.",
      "Place a simple pickup order if order capture is enabled.",
    ];
  }

  if (template.id === "salon_barber") {
    return [
      "Ask for hours and parking.",
      "Ask about a service price or duration.",
      "Request an appointment with a provider.",
      "Ask a product or sensitivity question.",
      "Ask to speak with the front desk.",
    ];
  }

  return [
    "Ask if the business serves your address or town.",
    `Ask about ${template.offeringNoun} and typical response time.`,
    `Request ${withIndefiniteArticle(template.appointmentNoun)} or estimate.`,
    "Describe an urgent issue and confirm it gets escalated.",
    "Ask an out-of-scope question and confirm SignalHost takes a message.",
  ];
}

function buildReadinessWarnings(draft: OnboardingDraft, assignedNumber: string) {
  const warnings: string[] = [];
  if (!String(draft.mainPhone || "").trim()) warnings.push("Add the current business main line before forwarding.");
  if (!String(draft.phoneLineType || "").trim()) warnings.push("Choose mobile, landline, VoIP, or not sure so setup instructions match the phone system.");
  if (!String(draft.websitePlatform || "").trim()) warnings.push("Add the website platform if the owner wants step-by-step chat widget instructions.");
  if (!assignedNumber || assignedNumber === assignedDemoPhoneNumber) warnings.push("Assign a real SignalHost number before forwarding customer calls.");
  return warnings;
}

function buildProviderScript(input: {
  assignedNumber: string;
  forwardingMode: string;
  mainPhone: string;
  provider: string;
  template: BusinessTemplate;
}) {
  const providerIntro = input.provider ? `Hi, we use ${input.provider} for our business line.` : "Hi, I need help with our business phone line.";
  const businessLine = input.mainPhone || "our main business number";
  const mode =
    input.forwardingMode === "Forward all calls"
      ? "forward all inbound calls"
      : input.forwardingMode === "After-hours forwarding"
        ? "forward calls after hours"
        : "forward unanswered calls after 3 to 4 rings and forward calls when the line is busy";

  return `${providerIntro} Please ${mode} from ${businessLine} to ${input.assignedNumber}. This is for SignalHost, our AI ${input.template.staffNoun}. Please make sure voicemail does not answer before the forwarding destination receives the call.`;
}

function buildWebsiteHandoffText(input: {
  businessName: string;
  contact: string;
  platform: string;
  snippet: string;
  websiteUrl: string;
}) {
  const greeting = input.contact
    ? `Please send this to ${input.contact}:`
    : "Send this to the person who manages the website:";
  const platformLine = input.platform && input.platform !== "Not sure" ? `The website platform is ${input.platform}.` : "I am not sure which website platform we use.";
  const websiteLine = input.websiteUrl ? `The website is ${input.websiteUrl}.` : "Please install this on the main website.";

  return `${greeting}

Please add SignalHost website chat to ${input.businessName}.
${websiteLine}
${platformLine}

Paste this snippet into the site-wide custom code area, ideally before the closing body tag:

${input.snippet}

After saving, open the website in a private browser window and confirm the chat button appears.`;
}

function buildLaunchPacketText(input: {
  businessName: string;
  firstTestScenarios: string[];
  ownerOperatingRules: LaunchInstructionBlock;
  phoneForwarding: PostInterviewLaunchGuide["phoneForwarding"];
  template: BusinessTemplate;
  websiteChat: PostInterviewLaunchGuide["websiteChat"];
}) {
  return [
    `SignalHost Launch Packet - ${input.businessName}`,
    "",
    `Phone setup: ${input.phoneForwarding.setupLabel}`,
    input.phoneForwarding.providerScript,
    "",
    "Phone setup steps:",
    ...input.phoneForwarding.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Website chat install:",
    ...input.websiteChat.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Website snippet:",
    input.websiteChat.snippet,
    "",
    "First test calls:",
    ...input.firstTestScenarios.map((step, index) => `${index + 1}. ${step}`),
    "",
    `${input.ownerOperatingRules.title}:`,
    ...input.ownerOperatingRules.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    `After tests pass, forward real ${input.template.customerNoun} calls and check Calls, Tasks, Analytics, and Ask SignalHost after the first day.`,
  ].join("\n");
}

function websiteInstallSteps(platform: string) {
  const normalized = platform.toLowerCase();

  if (normalized.includes("wordpress")) {
    return [
      "Copy the SignalHost snippet.",
      "Open WordPress admin and use the site's header/footer custom-code tool or a trusted custom-code plugin.",
      "Paste the snippet in the site-wide footer or before the closing body tag.",
      "Save, publish, then open the public site in a private browser window.",
    ];
  }

  if (normalized.includes("wix")) {
    return [
      "Copy the SignalHost snippet.",
      "Open the Wix dashboard and find Custom Code or Tracking & Analytics.",
      "Paste the snippet as site-wide body-end code.",
      "Publish the site, then open the public page and confirm the chat button appears.",
    ];
  }

  if (normalized.includes("squarespace")) {
    return [
      "Copy the SignalHost snippet.",
      "Open Squarespace settings and find Code Injection.",
      "Paste the snippet in the footer area.",
      "Save, then open the public site and send one test chat.",
    ];
  }

  if (normalized.includes("shopify")) {
    return [
      "Copy the SignalHost snippet.",
      "Open Shopify theme code or the store's custom pixel/custom-code area.",
      "Place the snippet in the main theme layout before the closing body tag.",
      "Save, preview the storefront, and confirm the chat button appears.",
    ];
  }

  if (normalized.includes("webflow")) {
    return [
      "Copy the SignalHost snippet.",
      "Open Webflow project settings or page settings and find custom code.",
      "Paste the snippet in the site-wide footer code.",
      "Publish, then open the live site and send one test chat.",
    ];
  }

  return [
    "Copy the SignalHost snippet.",
    "Open the website builder, CMS, or ask the web person for the site-wide custom-code area.",
    "Paste the snippet before the closing body tag on every page.",
    "Save or publish, then open the public website and confirm the chat button appears.",
  ];
}

function websitePromptsForVertical(template: BusinessTemplate) {
  if (template.id === "restaurant") return ["What are your hours?", "Can I make a reservation?", "Can I order online?"];
  if (template.id === "salon_barber") return ["Can I book?", "What services do you offer?", "What are your hours?"];
  if (template.id === "roofing") return ["Can I request an inspection?", "Do you handle storm damage?", "What areas do you serve?"];
  if (template.id === "hvac") return ["Can I book service?", "Do you handle emergencies?", "What areas do you serve?"];
  if (template.id === "plumbing") return ["Can I request service?", "Do you handle emergencies?", "What areas do you serve?"];
  return ["Can I book service?", "Can I request an estimate?", "What areas do you serve?"];
}

function withIndefiniteArticle(noun: string) {
  return `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}

function normalizeBaseUrl(value?: string) {
  return value?.trim().replace(/\/$/, "");
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
