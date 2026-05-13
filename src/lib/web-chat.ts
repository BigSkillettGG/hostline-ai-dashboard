import { voiceServiceBaseUrl } from "@/lib/voice-service";

export interface WebChatUiMessage {
  at?: string;
  role: "assistant" | "user";
  text: string;
}

export interface SendWebChatMessageInput {
  callId?: string;
  conversationId?: string;
  locationId?: string;
  message: string;
  transcript: WebChatUiMessage[];
  visitorEmail?: string;
  visitorId?: string;
  visitorName?: string;
  visitorPhone?: string;
}

export interface WebChatAction {
  link?: {
    description?: string;
    kind: string;
    label: string;
    url: string;
  };
  requestId?: string;
  requestType?: string;
  taskId?: string;
  type: "business_link" | "customer_request";
}

export interface WebChatMessageResult {
  actions: WebChatAction[];
  businessName: string;
  callId?: string;
  conversationId: string;
  locationId?: string;
  ok: boolean;
  reply: string;
  transcript: WebChatUiMessage[];
}

export async function sendWebChatMessage(input: SendWebChatMessageInput) {
  if (!voiceServiceBaseUrl) {
    throw new Error("VITE_VOICE_SERVICE_URL is not configured.");
  }

  const response = await fetch(`${voiceServiceBaseUrl}/web-chat/message`, {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Web chat failed with ${response.status}.`);
  }

  return (await response.json()) as WebChatMessageResult;
}
