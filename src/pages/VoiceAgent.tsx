import { useState } from "react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  afterHoursBehaviorLabels,
  callHandlingLabels,
  defaultRestaurantAgentConfig,
  orderDestinationLabels,
  reservationModeLabels,
  type AfterHoursBehavior,
  type CallHandlingMode,
  type OrderDestination,
  type ReservationMode,
} from "@/domain/restaurant-config";
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  CreditCard,
  PhoneCall,
  Play,
  Printer,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const variables = ["{restaurant_name}", "{caller_name}", "{hours_today}"];

const capabilityRows = [
  { key: "answerFaqs", name: "Answer FAQs", desc: "Hours, location, menu questions, policies" },
  { key: "takeOrders", name: "Take pickup orders", desc: "Items, modifiers, name, phone, pickup ETA" },
  { key: "handleReservations", name: "Handle reservations", desc: "Integrated booking or staff-confirmed requests" },
  { key: "sendSmsConfirmations", name: "Send SMS confirmations", desc: "Order and reservation summaries" },
  { key: "escalateToStaff", name: "Escalate to staff", desc: "Low confidence, allergy risk, complaints, human requests" },
] as const;

export default function VoiceAgent() {
  const [config, setConfig] = useState(defaultRestaurantAgentConfig);

  const setDestination = (destination: OrderDestination, checked: boolean) => {
    setConfig((current) => {
      const destinations = checked
        ? Array.from(new Set([...current.orders.destinations, destination]))
        : current.orders.destinations.filter((item) => item !== destination);

      return {
        ...current,
        orders: {
          ...current.orders,
          destinations,
        },
      };
    });
  };

  return (
    <>
      <PageHeader
        title="Voice Agent"
        description="Configure how the AI host answers, routes, and escalates calls"
        actions={
          <>
            <Button variant="outline" size="sm">
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Preview
            </Button>
            <Button size="sm" onClick={() => toast.success("Configuration saved")}>
              Save changes
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="h-4 w-4 text-primary" />
                  Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Host name</Label>
                    <Input
                      value={config.hostName}
                      onChange={(event) => setConfig({ ...config, hostName: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tone</Label>
                    <Select
                      value={config.tone}
                      onValueChange={(tone) => setConfig({ ...config, tone: tone as typeof config.tone })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                  <Textarea
                    rows={2}
                    value={config.greetingTemplate}
                    onChange={(event) => setConfig({ ...config, greetingTemplate: event.target.value })}
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {variables.map((variable) => (
                      <Badge key={variable} variant="secondary" className="cursor-pointer font-mono text-[10px] hover:bg-accent">
                        {variable}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <div className="text-sm font-medium">Light AI disclosure</div>
                    <div className="text-xs text-muted-foreground">Default greeting identifies the host as virtual.</div>
                  </div>
                  <Switch
                    checked={config.disclosureEnabled}
                    onCheckedChange={(disclosureEnabled) => setConfig({ ...config, disclosureEnabled })}
                  />
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
                    <Select
                      value={config.callHandlingMode}
                      onValueChange={(callHandlingMode) =>
                        setConfig({ ...config, callHandlingMode: callHandlingMode as CallHandlingMode })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(callHandlingLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Answer after rings</Label>
                    <Select
                      value={String(config.answerAfterRings)}
                      onValueChange={(answerAfterRings) =>
                        setConfig({ ...config, answerAfterRings: Number(answerAfterRings) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((count) => (
                          <SelectItem key={count} value={String(count)}>
                            {count}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>After-hours behavior</Label>
                    <Select
                      value={config.afterHoursBehavior}
                      onValueChange={(afterHoursBehavior) =>
                        setConfig({ ...config, afterHoursBehavior: afterHoursBehavior as AfterHoursBehavior })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(afterHoursBehaviorLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Escalation phone number</Label>
                    <Input
                      value={config.escalationPhoneNumber}
                      onChange={(event) => setConfig({ ...config, escalationPhoneNumber: event.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Capabilities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {capabilityRows.map((capability) => (
                  <div key={capability.key} className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{capability.name}</div>
                      <div className="text-xs text-muted-foreground">{capability.desc}</div>
                    </div>
                    <Switch
                      checked={config.capabilities[capability.key]}
                      onCheckedChange={(checked) =>
                        setConfig({
                          ...config,
                          capabilities: {
                            ...config.capabilities,
                            [capability.key]: checked,
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                    Order workflow
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <div className="text-sm font-medium">Take pickup orders</div>
                      <div className="text-xs text-muted-foreground">Guests pay when they arrive.</div>
                    </div>
                    <Switch
                      checked={config.orders.enabled}
                      onCheckedChange={(enabled) =>
                        setConfig({
                          ...config,
                          orders: { ...config.orders, enabled },
                          capabilities: { ...config.capabilities, takeOrders: enabled },
                        })
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Payment</Label>
                      <Select value={config.orders.paymentMode}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pay_at_pickup">Pay at pickup</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Default pickup ETA</Label>
                      <Input
                        type="number"
                        min={1}
                        value={config.orders.defaultPickupEtaMinutes}
                        onChange={(event) =>
                          setConfig({
                            ...config,
                            orders: { ...config.orders, defaultPickupEtaMinutes: Number(event.target.value) },
                          })
                        }
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Order destinations</Label>
                    {(Object.keys(orderDestinationLabels) as OrderDestination[]).map((destination) => (
                      <label key={destination} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                        <Checkbox
                          checked={config.orders.destinations.includes(destination)}
                          onCheckedChange={(checked) => setDestination(destination, checked === true)}
                        />
                        {orderDestinationLabels[destination]}
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Reservation workflow
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Reservation handling</Label>
                    <Select
                      value={config.reservations.mode}
                      onValueChange={(mode) =>
                        setConfig({
                          ...config,
                          reservations: { ...config.reservations, mode: mode as ReservationMode },
                          capabilities: { ...config.capabilities, handleReservations: mode !== "disabled" },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(reservationModeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Provider</Label>
                    <Select
                      value={config.reservations.provider}
                      onValueChange={(provider) =>
                        setConfig({
                          ...config,
                          reservations: { ...config.reservations, provider: provider as typeof config.reservations.provider },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="opentable">OpenTable</SelectItem>
                        <SelectItem value="yelp_guest_manager">Yelp Guest Manager</SelectItem>
                        <SelectItem value="sevenrooms">SevenRooms</SelectItem>
                        <SelectItem value="resy">Resy</SelectItem>
                        <SelectItem value="tock">Tock</SelectItem>
                        <SelectItem value="none">No provider</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Auto-confirm party size limit</Label>
                    <Input
                      type="number"
                      min={1}
                      value={config.reservations.maxPartySizeWithoutConfirmation}
                      onChange={(event) =>
                        setConfig({
                          ...config,
                          reservations: {
                            ...config.reservations,
                            maxPartySizeWithoutConfirmation: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-warning/30 bg-warning/10 p-3">
                    <div>
                      <div className="text-sm font-medium">Manual requests need staff confirmation</div>
                      <div className="text-xs text-muted-foreground">Used when no reservation integration is connected.</div>
                    </div>
                    <Switch
                      checked={config.reservations.requireStaffConfirmationWithoutIntegration}
                      onCheckedChange={(requireStaffConfirmationWithoutIntegration) =>
                        setConfig({
                          ...config,
                          reservations: { ...config.reservations, requireStaffConfirmationWithoutIntegration },
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Voice preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Voice</Label>
                  <Select defaultValue="vera">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vera">Vera - warm female</SelectItem>
                      <SelectItem value="leo">Leo - friendly male</SelectItem>
                      <SelectItem value="ana">Ana - bright female</SelectItem>
                      <SelectItem value="rio">Rio - calm neutral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="text-xs text-muted-foreground">Sample phrase</div>
                  <p className="mt-1 text-sm italic">{config.greetingTemplate}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => toast("Playing preview...")}>
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Play sample
                  </Button>
                </div>
                <Button className="w-full" onClick={() => toast.success("Test call queued")}>
                  <PhoneCall className="mr-1.5 h-4 w-4" />
                  Test call
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Launch readiness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ReadinessRow icon={PhoneCall} label="Call mode" value={callHandlingLabels[config.callHandlingMode]} />
                <ReadinessRow icon={ShoppingBag} label="Orders" value={config.orders.enabled ? "Enabled" : "Disabled"} />
                <ReadinessRow icon={CreditCard} label="Payment" value="Pay at pickup" />
                <ReadinessRow icon={Printer} label="Order routing" value={`${config.orders.destinations.length} destinations`} />
                <ReadinessRow icon={CalendarDays} label="Reservations" value={reservationModeLabels[config.reservations.mode]} />
                <ReadinessRow icon={AlertTriangle} label="Escalation" value={config.escalationPhoneNumber} />
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function ReadinessRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof PhoneCall;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}
