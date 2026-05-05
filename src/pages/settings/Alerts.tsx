import { useEffect, useState } from "react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ShieldAlert, Briefcase, Save } from "lucide-react";
import { toast } from "sonner";

// TODO: persist via Lovable Cloud + send alerts via Twilio (SMS) and Lovable Email
// in a future `supabase/functions/send-escalation-alert` edge function.

type Channel = "sms" | "email" | "both";
type Severity = "low" | "medium" | "high";

interface Recipient {
  id: string;
  name: string;
  phone: string;
  email: string;
  channel: Channel;
}

interface AlertConfig {
  complaints: {
    offerManagerConnect: boolean;
    promiseCallback: boolean;
    severityThreshold: Severity;
    quietHoursEnabled: boolean;
    recipients: Recipient[];
  };
  sales: {
    askIntent: boolean;
    takeMessageDefault: boolean;
    recipients: Recipient[];
  };
}

const STORAGE_KEY = "hostline.alertRouting";

const defaults: AlertConfig = {
  complaints: {
    offerManagerConnect: true,
    promiseCallback: true,
    severityThreshold: "low",
    quietHoursEnabled: false,
    recipients: [
      { id: "r1", name: "Maria Lombardi", phone: "+1 415-555-0148", email: "maria@oliveandember.com", channel: "both" },
    ],
  },
  sales: {
    askIntent: true,
    takeMessageDefault: true,
    recipients: [
      { id: "r2", name: "Owner", phone: "", email: "owner@oliveandember.com", channel: "email" },
    ],
  },
};

export default function Alerts() {
  const [config, setConfig] = useState<AlertConfig>(defaults);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setConfig({ ...defaults, ...JSON.parse(raw) });
    } catch {
      setConfig(defaults);
    }
  }, []);

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    toast.success("Alert routing saved");
  };

  const addRecipient = (group: "complaints" | "sales") => {
    setConfig((c) => ({
      ...c,
      [group]: {
        ...c[group],
        recipients: [...c[group].recipients, { id: crypto.randomUUID(), name: "", phone: "", email: "", channel: "sms" }],
      },
    }));
  };

  const updateRecipient = (group: "complaints" | "sales", id: string, patch: Partial<Recipient>) => {
    setConfig((c) => ({
      ...c,
      [group]: {
        ...c[group],
        recipients: c[group].recipients.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      },
    }));
  };

  const removeRecipient = (group: "complaints" | "sales", id: string) => {
    setConfig((c) => ({
      ...c,
      [group]: { ...c[group], recipients: c[group].recipients.filter((r) => r.id !== id) },
    }));
  };

  const renderRecipients = (group: "complaints" | "sales") => {
    const list = config[group].recipients;
    return (
      <div className="space-y-2">
        {list.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No recipients yet — add at least one so alerts get delivered.
          </div>
        )}
        {list.map((r) => (
          <div key={r.id} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-12">
            <div className="sm:col-span-3 space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={r.name} onChange={(e) => updateRecipient(group, r.id, { name: e.target.value })} placeholder="Manager name" className="h-9" />
            </div>
            <div className="sm:col-span-3 space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input value={r.phone} onChange={(e) => updateRecipient(group, r.id, { phone: e.target.value })} placeholder="+1 415-555-0000" className="h-9" />
            </div>
            <div className="sm:col-span-4 space-y-1">
              <Label className="text-xs">Email</Label>
              <Input value={r.email} onChange={(e) => updateRecipient(group, r.id, { email: e.target.value })} placeholder="manager@restaurant.com" className="h-9" />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Channel</Label>
              <div className="flex items-center gap-1">
                <Select value={r.channel} onValueChange={(v) => updateRecipient(group, r.id, { channel: v as Channel })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeRecipient(group, r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => addRecipient(group)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />Add recipient
        </Button>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Alerts & Routing"
        description="Decide who gets notified when callers need a manager"
        actions={<Button size="sm" onClick={save}><Save className="mr-1.5 h-3.5 w-3.5" />Save changes</Button>}
      />
      <PageBody className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="h-4 w-4 text-destructive" />Customer complaints
            </CardTitle>
            <p className="text-xs text-muted-foreground">When a caller sounds upset or reports an issue, the AI host can offer a manager callback and forward a summary.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Offer to connect a manager</div>
                  <div className="text-xs text-muted-foreground">Triggered when sentiment is negative or caller asks for a manager about an issue.</div>
                </div>
                <Switch checked={config.complaints.offerManagerConnect} onCheckedChange={(v) => setConfig((c) => ({ ...c, complaints: { ...c.complaints, offerManagerConnect: v } }))} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Tell caller a manager will call them back</div>
                  <div className="text-xs text-muted-foreground">"I've let the manager know — they'll call you back shortly."</div>
                </div>
                <Switch checked={config.complaints.promiseCallback} onCheckedChange={(v) => setConfig((c) => ({ ...c, complaints: { ...c.complaints, promiseCallback: v } }))} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Severity threshold</div>
                  <div className="text-xs text-muted-foreground">Only escalate complaints at or above this level.</div>
                </div>
                <Select value={config.complaints.severityThreshold} onValueChange={(v) => setConfig((c) => ({ ...c, complaints: { ...c.complaints, severityThreshold: v as Severity } }))}>
                  <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (all)</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Quiet hours</div>
                  <div className="text-xs text-muted-foreground">Hold non-urgent alerts until next opening hour.</div>
                </div>
                <Switch checked={config.complaints.quietHoursEnabled} onCheckedChange={(v) => setConfig((c) => ({ ...c, complaints: { ...c.complaints, quietHoursEnabled: v } }))} />
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recipients</div>
              {renderRecipients("complaints")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4 text-warning" />Sales / vendor calls
            </CardTitle>
            <p className="text-xs text-muted-foreground">When someone asks for a manager about sales, vendor, or supplier matters, take a message instead of transferring.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Ask caller to identify their intent</div>
                  <div className="text-xs text-muted-foreground">"Is this a sales/vendor inquiry, or an issue I can help with?"</div>
                </div>
                <Switch checked={config.sales.askIntent} onCheckedChange={(v) => setConfig((c) => ({ ...c, sales: { ...c.sales, askIntent: v } }))} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Take a message by default</div>
                  <div className="text-xs text-muted-foreground">Don't transfer or interrupt the manager — log it and notify the recipients below.</div>
                </div>
                <Switch checked={config.sales.takeMessageDefault} onCheckedChange={(v) => setConfig((c) => ({ ...c, sales: { ...c.sales, takeMessageDefault: v } }))} />
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recipients</div>
              {renderRecipients("sales")}
            </div>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
