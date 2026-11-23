import { BellRingIcon, CircleCheckIcon } from "lucide-react";

import { ProjectRoleBadge, type AttentionItem } from "@/entities/project";
import { underConstruction } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/shadcn/button";

/** "Needs attention": what's waiting on the viewer, each with the one action that resolves it. */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleCheckIcon className="size-4 shrink-0 text-success" aria-hidden />
        Nothing needs your attention right now.
      </p>
    );
  }
  return (
    <ul aria-label="Needs attention" className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <span className="flex min-w-0 items-start gap-2">
            <BellRingIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 space-y-1 text-sm">
              <span className="flex flex-wrap items-center gap-1.5 font-medium">
                {item.project_title}
                {item.role ? <ProjectRoleBadge role={item.role} /> : null}
              </span>
              <span className="block text-muted-foreground">{item.text}</span>
            </span>
          </span>
          <Button size="sm" onClick={() => underConstruction(item.action_label)}>
            {item.action_label}
            <span className="sr-only">: {item.project_title}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
