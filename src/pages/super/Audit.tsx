import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const events = [
  { ts: "2026-05-05 09:14", actor: "staff@signalhost.ai", action: "Issued $25 credit", target: "Olive & Ember" },
  { ts: "2026-05-05 08:47", actor: "system", action: "Webhook retry succeeded", target: "voice/conversation-relay" },
  { ts: "2026-05-04 22:03", actor: "staff@signalhost.ai", action: "Updated system prompt template", target: "global" },
  { ts: "2026-05-04 17:30", actor: "system", action: "Tenant exceeded plan", target: "North Pier Oyster" },
  { ts: "2026-05-04 11:12", actor: "maria@oliveandember.com", action: "Updated knowledge base", target: "Olive & Ember" },
];

export default function Audit() {
  return (
    <>
      <PageHeader title="Audit log" description="System-wide activity" />
      <PageBody>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {events.map((e, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">{e.ts}</span>
                    <Badge variant="outline">{e.actor}</Badge>
                    <span>{e.action}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{e.target}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
