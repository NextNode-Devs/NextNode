import { CheckIcon, CircleDotIcon, CircleIcon } from "lucide-react";

import type { LeadResignSnapshot } from "@/entities/team";
import { cn } from "@/shared/lib/utils";

type StepState = "done" | "current" | "todo";

const STATE_TEXT: Record<StepState, string> = { done: "done", current: "now", todo: "next" };

/** Proposed → client approves → new Lead signs: where this Lead change is. */
export function LeadChangeSteps({ snapshot }: { snapshot: LeadResignSnapshot }) {
  const name = snapshot.new_lead.display_name;
  const approved = snapshot.approved_at !== null;
  const signed = snapshot.situation === "signed";
  const steps: { label: string; state: StepState }[] = [
    { label: `${snapshot.proposed_by} proposed ${name}`, state: "done" },
    { label: `The client, ${snapshot.client.display_name}, approves`, state: approved ? "done" : "current" },
    {
      label: `${name} signs offer version ${snapshot.offer.version}`,
      state: signed ? "done" : approved ? "current" : "todo",
    },
  ];
  return (
    <ol aria-label="Lead change" className="space-y-2 text-sm">
      {steps.map((step, index) => {
        const Icon = step.state === "done" ? CheckIcon : step.state === "current" ? CircleDotIcon : CircleIcon;
        return (
          <li
            key={step.label}
            aria-current={step.state === "current" ? "step" : undefined}
            className={cn("flex items-start gap-2", step.state === "todo" && "text-muted-foreground")}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                step.state === "done" && "text-success",
                step.state === "current" && "text-warning",
              )}
              aria-hidden
            />
            <span>
              <span className="sr-only">
                Step {index + 1}, {STATE_TEXT[step.state]}:{" "}
              </span>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
