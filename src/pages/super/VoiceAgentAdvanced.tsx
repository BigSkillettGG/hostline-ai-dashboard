import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function VoiceAgentAdvanced() {
  return (
    <>
      <PageHeader
        title="Voice Agent · Internals"
        description="Global voice & model defaults applied across tenants"
        actions={<Button size="sm" onClick={() => toast.success("Saved")}>Save</Button>}
      />
      <PageBody>
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Voice & model</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Voice provider</Label>
                  <Select defaultValue="elevenlabs">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                      <SelectItem value="cartesia">Cartesia</SelectItem>
                      <SelectItem value="openai">OpenAI Realtime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Default voice</Label>
                  <Select defaultValue="rachel">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rachel">Rachel · Warm female</SelectItem>
                      <SelectItem value="josh">Josh · Friendly male</SelectItem>
                      <SelectItem value="sofia">Sofia · Professional female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>LLM model</Label>
                  <Select defaultValue="gpt-4o">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                      <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                      <SelectItem value="claude-sonnet">claude-sonnet-4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>ASR provider</Label>
                  <Select defaultValue="deepgram">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deepgram">Deepgram nova-3</SelectItem>
                      <SelectItem value="whisper">Whisper-large-v3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>ASR confidence threshold</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">0.62</span>
                </div>
                <Slider defaultValue={[62]} max={100} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>End-of-turn silence (ms)</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">450</span>
                </div>
                <Slider defaultValue={[450]} max={1500} step={50} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">System prompt template</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea rows={10} defaultValue={`You are {host_name}, the AI phone host for {restaurant_name}.\nTone: {tone}.\nAlways disclose you are virtual on first turn.\nFollow the menu and knowledge base verbatim — never invent items, prices, or hours.\nEscalate any allergy, refund, or complaint.\nKeep replies under 2 sentences.`} className="font-mono text-xs" />
              <div className="flex flex-wrap gap-1.5">
                {["{host_name}", "{restaurant_name}", "{tone}", "{hours_today}", "{caller_name}"].map((v) => (
                  <Badge key={v} variant="secondary" className="font-mono text-[10px]">{v}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Disclosure & fallbacks</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Disclosure phrase</Label>
                <Input defaultValue="Just so you know, I'm a virtual host — I can take orders or pass you to a person." />
              </div>
              <div className="space-y-1.5">
                <Label>Low-confidence fallback</Label>
                <Input defaultValue="Sorry, I want to make sure I get this right — let me grab a teammate." />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">Auto-transfer on 3 retries</div>
                  <div className="text-xs text-muted-foreground">Bail out to staff after three low-confidence turns.</div>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Webhooks</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Call event webhook</Label>
                <Input className="font-mono text-xs" defaultValue="https://api.signalhost.ai/webhooks/calls" />
              </div>
              <div className="space-y-1.5">
                <Label>Order event webhook</Label>
                <Input className="font-mono text-xs" defaultValue="https://api.signalhost.ai/webhooks/orders" />
              </div>
              <Button variant="outline" size="sm" onClick={() => toast.success("Test ping sent")}>Send test ping</Button>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
