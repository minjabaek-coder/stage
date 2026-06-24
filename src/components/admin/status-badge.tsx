import { Badge } from "@/components/ui/badge";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline"; className?: string }
> = {
  draft: { label: "초안", variant: "secondary" },
  submitted: {
    label: "검토대기",
    variant: "default",
    className: "bg-amber-500 text-white hover:bg-amber-500/90",
  },
  published: { label: "발행됨", variant: "default" },
  unpublished: { label: "미발행", variant: "outline" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? {
    label: status,
    variant: "outline" as const,
  };
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
