import { formatMoney } from "@/shared/lib/format-money";
import { Badge } from "@/shared/ui/shadcn/badge";

import { KIND_LABEL, STATUS_LABEL, type ProjectKind, type ProjectStatus, type Skill } from "../model/project";

export function KindBadge({ kind }: { kind: ProjectKind }) {
  return <Badge variant={kind === "client" ? "secondary" : "outline"}>{KIND_LABEL[kind]}</Badge>;
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge variant="outline">{STATUS_LABEL[status]}</Badge>;
}

/** Always labelled as a proposal: the accepted offer (#6) sets the project total. */
export function ProposedBudget({ cents }: { cents: number }) {
  return (
    <span>
      <span className="text-muted-foreground">Proposed budget </span>
      <span className="font-medium">{formatMoney(cents, "cad")}</span>
    </span>
  );
}

export function TechStack({ tech, label = "Tech stack" }: { tech: Skill[]; label?: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1.5">
      {tech.map((skill) => (
        <li key={skill.key}>
          <Badge variant="secondary" className="font-normal">
            {skill.label}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
