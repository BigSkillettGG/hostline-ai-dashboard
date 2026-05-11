export type TranscriptRole = "agent" | "caller";

export interface TranscriptTurn {
  role: TranscriptRole;
  text: string;
  at: string;
}

export interface ConversationRelaySetupMessage {
  type: "setup";
  sessionId: string;
  accountSid?: string;
  parentCallSid?: string;
  callSid: string;
  from?: string;
  to?: string;
  forwardedFrom?: string;
  callType?: string;
  callerName?: string;
  direction?: string;
  callStatus?: string;
  customParameters?: Record<string, string>;
}

export interface ConversationRelayPromptMessage {
  type: "prompt";
  voicePrompt: string;
  lang?: string;
  last?: boolean;
}

export interface ConversationRelayDtmfMessage {
  type: "dtmf";
  digit: string;
}

export interface ConversationRelayInterruptMessage {
  type: "interrupt";
  utteranceUntilInterrupt?: string;
  durationUntilInterruptMs?: number;
}

export interface ConversationRelayErrorMessage {
  type: "error";
  description: string;
}

export type ConversationRelayInboundMessage =
  | ConversationRelaySetupMessage
  | ConversationRelayPromptMessage
  | ConversationRelayDtmfMessage
  | ConversationRelayInterruptMessage
  | ConversationRelayErrorMessage;

export interface ConversationRelayTextMessage {
  type: "text";
  token: string;
  last: boolean;
  interruptible?: boolean;
  preemptible?: boolean;
  lang?: string;
}

export interface ConversationRelayEndMessage {
  type: "end";
  handoffData?: string;
}
