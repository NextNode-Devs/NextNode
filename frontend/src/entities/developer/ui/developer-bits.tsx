import { CircleCheckIcon } from "lucide-react";

import { Badge } from "@/shared/ui/shadcn/badge";

import type { Skill } from "../model/developer";

/** Shown only when the developer has said they're available; absence says nothing. */
export function AvailabilityBadge({ available }: { available: boolean }) {
  if (!available) return null;
  return (
    <Badge variant="outline" className="gap-1 border-success/40 text-success">
      <CircleCheckIcon aria-hidden />
      Available for work
    </Badge>
  );
}

export function SkillList({ skills, label = "Skills" }: { skills: Skill[]; label?: string }) {
  if (!skills.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={label}>
      {skills.map((skill) => (
        <li key={skill.key}>
          <Badge variant="secondary">{skill.label}</Badge>
        </li>
      ))}
    </ul>
  );
}
