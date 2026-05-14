import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Globe2,
  Link2,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { buildWebsiteChatSnippet } from "@/domain/launch-guide";
import { getOnboardingBusinessTemplate } from "@/domain/onboarding";
import { loadOnboardingDraft } from "@/lib/onboarding-draft";
import { getActiveSupabaseLocationId } from "@/lib/supabase-rest";
import { cn } from "@/lib/utils";
import { isVoiceServiceConfigured, voiceServiceBaseUrl } from "@/lib/voice-service";
import { sendWebChatMessage, type WebChatAction, type WebChatUiMessage } from "@/lib/web-chat";

interface ChatMessage extends WebChatUiMessage {
  actions?: WebChatAction[];
  id: string;
}

export default function WebsiteChat() {
  const activeLocationId = getActiveSupabaseLocationId();
  const draftProfile = loadOnboardingDraft();
  const businessTemplate = getOnboardingBusinessTemplate(draftProfile);
  const businessName = String(draftProfile.restaurantName || businessTemplate.defaultName);
  const starterGreeting = `Hi, thanks for reaching out to ${businessName}. How can I help?`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      at: new Date().toISOString(),
      id: "assistant-start",
      role: "assistant",
      text: starterGreeting,
    },
  ]);
  const [draft, setDraft] = useState("Do you have a link for reservations tonight?");
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatCallId, setChatCallId] = useState<string>();
  const conversationId = useMemo(() => `dashboard_preview_${createConversationToken()}`, []);

  const embedSnippet = useMemo(() => {
    return buildWebsiteChatSnippet({
      appBaseUrl: resolvePublicAppBaseUrl(),
      businessName,
      locationId: activeLocationId,
      template: businessTemplate,
      voiceServiceUrl: voiceServiceBaseUrl,
    });
  }, [activeLocationId, businessName, businessTemplate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const messageText = draft.trim();
    if (!messageText || isSending) return;

    const userMessage: ChatMessage = {
      at: new Date().toISOString(),
      id: `user-${Date.now()}`,
      role: "user",
      text: messageText,
    };
    const transcript = messages.map(({ role, text, at }) => ({ at, role, text }));
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsSending(true);

    try {
      const result = await sendWebChatMessage({
        locationId: activeLocationId,
        callId: chatCallId,
        conversationId,
        message: messageText,
        transcript,
        visitorEmail: visitorEmail.trim() || undefined,
        visitorId: "dashboard-preview",
        visitorName: visitorName.trim() || undefined,
        visitorPhone: visitorPhone.trim() || undefined,
      });
      setChatCallId((current) => result.callId || current);
      setMessages((current) => [
        ...current,
        {
          actions: result.actions,
          at: new Date().toISOString(),
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: result.reply,
        },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Web chat failed");
      setMessages((current) => [
        ...current,
        {
          at: new Date().toISOString(),
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: "I hit a setup snag in the preview. Please check the voice service URL and try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function copySnippet() {
    await navigator.clipboard.writeText(embedSnippet);
    toast.success("Embed snippet copied");
  }

  return (
    <>
      <PageHeader
        title="Website Chat"
        description="Use the same SignalHost brain on the website, with chat-friendly replies and staff follow-up."
        actions={
          <Badge variant="outline" className={cn(
            "gap-1.5",
            isVoiceServiceConfigured()
              ? "border-success/30 bg-success/10 text-success"
              : "border-warning/30 bg-warning/10 text-warning",
          )}>
            <Globe2 className="h-3.5 w-3.5" />
            {isVoiceServiceConfigured() ? "Voice service connected" : "Set VITE_VOICE_SERVICE_URL"}
          </Badge>
        }
      />

      <PageBody className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  Channel setup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatusTile icon={Sparkles} label="Brain" value="SignalHost brain" />
                  <StatusTile icon={Link2} label="Links" value="Orders, booking, quote" />
                  <StatusTile icon={ShieldCheck} label="Fallback" value="Staff request" />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="embed-snippet">Embed snippet</Label>
                  <Textarea
                    id="embed-snippet"
                    className="min-h-32 resize-none font-mono text-xs"
                    readOnly
                    value={embedSnippet}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    Preview service: {voiceServiceBaseUrl || "not configured"}
                  </div>
                  <Button variant="outline" size="sm" onClick={copySnippet}>
                    <Clipboard className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Preview visitor</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="visitor-name">Name</Label>
                  <Input
                    id="visitor-name"
                    placeholder="Optional"
                    value={visitorName}
                    onChange={(event) => setVisitorName(event.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="visitor-phone">Phone</Label>
                    <Input
                      id="visitor-phone"
                      placeholder="+1..."
                      value={visitorPhone}
                      onChange={(event) => setVisitorPhone(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="visitor-email">Email</Label>
                    <Input
                      id="visitor-email"
                      placeholder="guest@example.com"
                      value={visitorEmail}
                      onChange={(event) => setVisitorEmail(event.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-border bg-card px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">{businessName}</div>
                    <div className="text-xs text-muted-foreground">Website chat preview</div>
                  </div>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Shared context
                </Badge>
              </div>
            </div>

            <div className="flex min-h-[520px] flex-col bg-muted/20">
              <div className="flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
                {messages.map((message) => (
                  <ChatBubble key={message.id} message={message} />
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
                      SignalHost is checking that.
                    </div>
                  </div>
                )}
              </div>
              <form onSubmit={handleSubmit} className="border-t border-border bg-card p-3 md:p-4">
                <div className="flex gap-2">
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Ask about hours, menu, reservations, orders, or a callback..."
                    disabled={isSending}
                  />
                  <Button type="submit" disabled={isSending || !draft.trim()} aria-label="Send chat message">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

function StatusTile({ icon: Icon, label, value }: {
  icon: typeof MessageCircle;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-2 text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function createConversationToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function resolvePublicAppBaseUrl() {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window === "undefined") return "https://signalhost.ai";
  const origin = window.location.origin.replace(/\/$/, "");
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) return origin;
  return "https://signalhost.ai";
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={cn("flex", isAssistant ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[82%] rounded-md px-3 py-2 text-sm shadow-sm",
          isAssistant
            ? "border border-border bg-card text-card-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium opacity-70">
          {isAssistant ? "SignalHost" : "Visitor"}
          {isAssistant && <ExternalLink className="h-3 w-3 opacity-0" aria-hidden="true" />}
        </div>
        <div className="whitespace-pre-wrap leading-relaxed">{message.text}</div>
        {isAssistant && message.actions?.length ? (
          <div className="mt-3 space-y-2">
            {message.actions.map((action, index) => (
              action.type === "business_link" && action.link ? (
                <a
                  key={`${action.link.url}-${index}`}
                  className="block rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-primary"
                  href={action.link.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {action.link.label}
                  <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">
                    {action.link.description || action.link.url}
                  </span>
                </a>
              ) : null
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
