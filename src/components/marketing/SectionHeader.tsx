import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow, title, subtitle, align = "left", className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn(
      "max-w-2xl",
      align === "center" && "mx-auto text-center",
      className
    )}>
      {eyebrow && (
        <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase text-primary">
          <span className="h-px w-6 bg-primary/60" />
          {eyebrow}
        </div>
      )}
      <h2 className="text-3xl font-semibold text-foreground md:text-4xl lg:text-[44px] lg:leading-[1.05]">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base text-muted-foreground md:text-lg">{subtitle}</p>
      )}
    </div>
  );
}
