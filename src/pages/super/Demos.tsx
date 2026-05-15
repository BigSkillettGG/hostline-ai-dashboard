import { Link } from "react-router-dom";
import { Copy, ExternalLink, Mail, MessageSquareText, Phone, UserRound, type LucideIcon } from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildDemoAgentEmail,
  getDemoBusinessLabel,
  getDemoVoiceEmployeeName,
  verticalDemoProfiles,
} from "@/domain/demo-verticals";
import { signalHostVoiceProfilesById } from "@/domain/voice-selection";
import { toast } from "sonner";

export default function SuperDemos() {
  return (
    <>
      <PageHeader
        title="Demo Library"
        description="One ready-to-show business per vertical with demo credentials, contact channels, and a live website chat sandbox."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/login?demo=1">
              <UserRound className="mr-1.5 h-3.5 w-3.5" />
              Demo login
            </Link>
          </Button>
        }
      />
      <PageBody>
        <div className="grid gap-4 xl:grid-cols-2">
          {verticalDemoProfiles.map((profile) => {
            const agentEmail = buildDemoAgentEmail(profile);
            const employeeName = getDemoVoiceEmployeeName(profile);
            const voiceProfile = signalHostVoiceProfilesById[profile.voiceProfileId];
            return (
              <Card key={profile.demoSiteSlug} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="border-b border-border bg-muted/25 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-semibold">{profile.businessName}</h2>
                          <Badge variant="outline">{getDemoBusinessLabel(profile)}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{profile.subtitle}</p>
                      </div>
                      <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                        {profile.planName}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-5 p-5 md:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-4">
                      <ChannelRow
                        icon={Phone}
                        label="Call demo"
                        value={profile.aiNumber}
                        actionLabel="Copy"
                        onAction={() => copyValue(profile.aiNumber, "Copied phone number")}
                      />
                      <ChannelRow
                        icon={MessageSquareText}
                        label="Text demo"
                        value={`${profile.aiNumber} (A2P placeholder)`}
                        actionLabel="Copy"
                        onAction={() => copyValue(profile.aiNumber, "Copied SMS number")}
                      />
                      <ChannelRow
                        icon={Mail}
                        label="Email demo"
                        value={agentEmail.address}
                        actionLabel="Copy"
                        onAction={() => copyValue(agentEmail.address, "Copied agent email")}
                      />
                      <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                        Texting is intentionally marked as a placeholder until Twilio A2P registration is complete. Email is routable once the Resend inbound domain is active.
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-lg border border-border p-4">
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Owner account</div>
                        <div className="mt-3 grid gap-2 text-sm">
                          <CopyLine label="Email" value={profile.accountEmail} />
                          <CopyLine label="Password" value={profile.accountPassword} />
                          <CopyLine label="Location ID" value={profile.locationId} />
                        </div>
                      </div>
                      <div className="rounded-lg border border-border p-4">
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">SignalHost</div>
                        <div className="mt-3 text-sm">
                          <div className="font-medium">{employeeName}</div>
                          <div className="text-muted-foreground">{voiceProfile.label}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 border-t border-border p-5 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="text-sm font-medium">Try these prompts on the website chat</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profile.samplePrompts.map((prompt) => (
                          <Badge key={prompt} variant="secondary" className="max-w-full whitespace-normal text-left">
                            {prompt}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Button asChild variant="outline">
                        <Link to={`/demo-sites/${profile.demoSiteSlug}`} target="_blank">
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Website
                        </Link>
                      </Button>
                      <Button asChild>
                        <Link to={`/login?demo=1&profile=${profile.demoSiteSlug}`}>
                          Owner login
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}

function ChannelRow({
  actionLabel,
  icon: Icon,
  label,
  onAction,
  value,
}: {
  actionLabel: string;
  icon: LucideIcon;
  label: string;
  onAction: () => void;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[82px_1fr_auto] items-center gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-xs">{value}</span>
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyValue(value, `Copied ${label.toLowerCase()}`)}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function copyValue(value: string, message: string) {
  void navigator.clipboard?.writeText(value);
  toast.success(message);
}
