import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bot, Play, PhoneCall, Sparkles } from "lucide-react";
import { toast } from "sonner";

const capabilities = [
  { id: "faq", name: "Answer FAQs", desc: "Hours, location, allergies, policies" },
  { id: "orders", name: "Take orders", desc: "Pickup orders with modifiers" },
  { id: "reservations", name: "Handle reservations", desc: "Book and confirm tables" },
  { id: "sms", name: "Send SMS confirmations", desc: "Text guests order/booking details" },
  { id: "escalate", name: "Escalate to staff", desc: "Forward complex calls" },
];

const variables = ["{restaurant_name}", "{caller_name}", "{hours_today}"];

export default function VoiceAgent() {
  return (
    <>
      <PageHeader
        title="Voice Agent"
        description="Configure how your AI host answers and behaves on the phone"
        actions={
          <>
            <Button variant="outline" size="sm"><Play className="mr-1.5 h-3.5 w-3.5" />Preview</Button>
            <Button size="sm" onClick={() => toast.success("Configuration saved")}>Save changes</Button>
          </>
        }
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4 text-primary" />Identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Host name</Label>
                    <Input defaultValue="Vera" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tone</Label>
                    <Select defaultValue="warm">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warm">Warm</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="playful">Playful</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Greeting</Label>
                  <Textarea rows={2} defaultValue="Thanks for calling {restaurant_name}, this is Vera. How can I help you today?" />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {variables.map(v => (
                      <Badge key={v} variant="secondary" className="font-mono text-[10px] cursor-pointer hover:bg-accent">{v}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Call handling</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Mode</Label>
                    <Select defaultValue="overflow">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="always">Always answer</SelectItem>
                        <SelectItem value="after_hours">After hours only</SelectItem>
                        <SelectItem value="overflow">Overflow (when busy)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Answer after rings</Label>
                    <Select defaultValue="3">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>After-hours behavior</Label>
                  <Select defaultValue="take_message">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="take_message">Take a message</SelectItem>
                      <SelectItem value="answer_faq">Answer FAQs only</SelectItem>
                      <SelectItem value="full">Full functionality</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Escalation phone number</Label>
                  <Input defaultValue="+1 (415) 555-0199" />
                  <p className="text-xs text-muted-foreground">Used when AI confidence is low or guest asks for a human.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Capabilities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {capabilities.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.desc}</div>
                    </div>
                    <Switch defaultChecked={c.id !== "escalate" ? true : true} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Voice preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Voice</Label>
                  <Select defaultValue="vera">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vera">Vera · Warm female</SelectItem>
                      <SelectItem value="leo">Leo · Friendly male</SelectItem>
                      <SelectItem value="ana">Ana · Bright female</SelectItem>
                      <SelectItem value="rio">Rio · Calm neutral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="text-xs text-muted-foreground">Sample phrase</div>
                  <p className="mt-1 text-sm italic">"Thanks for calling Olive & Ember, this is Vera. How can I help you today?"</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => toast("Playing preview…")}>
                    <Play className="mr-1.5 h-3.5 w-3.5" />Play sample
                  </Button>
                </div>
                <Button className="w-full" onClick={() => toast.success("Test call queued — your phone will ring shortly")}>
                  <PhoneCall className="mr-1.5 h-4 w-4" />Test call
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}
