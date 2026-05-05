import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";

export function TestimonialCard({
  quote, name, title, restaurant, city, initials,
}: {
  quote: string; name: string; title: string; restaurant: string; city: string; initials: string;
}) {
  return (
    <Card className="flex h-full flex-col border-border/80 shadow-[0_1px_0_hsl(var(--border)),0_24px_48px_-32px_hsl(var(--foreground)/0.18)]">
      <CardContent className="flex flex-1 flex-col gap-5 p-6">
        <Quote className="h-6 w-6 text-primary/40" />
        <p className="flex-1 text-base leading-relaxed text-foreground">"{quote}"</p>
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{name}</div>
            <div className="truncate text-xs text-muted-foreground">{title} · {restaurant}</div>
            <div className="truncate text-xs text-muted-foreground">{city}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
