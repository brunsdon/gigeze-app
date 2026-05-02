import { Visibility } from "@prisma/client";
import { Globe, Lock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const visibilityConfig: Record<Visibility, { label: string; variant: "secondary" | "outline" | "default"; Icon: React.ComponentType<{ className?: string }> }> = {
  PRIVATE: { label: "Private", variant: "outline", Icon: Lock },
  SHARED: { label: "Shared", variant: "secondary", Icon: Users },
  PUBLIC: { label: "Public", variant: "default", Icon: Globe },
};

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const { label, variant, Icon } = visibilityConfig[visibility] ?? visibilityConfig.PRIVATE;

  return (
    <Badge variant={variant}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
