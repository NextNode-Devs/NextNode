"use client";

import { BriefcaseIcon, CodeIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import type { Role } from "@/entities/viewer";
import { cn } from "@/shared/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/shared/ui/shadcn/radio-group";

const OPTIONS: { value: Role; title: string; description: string; icon: typeof CodeIcon }[] = [
  {
    value: "developer",
    title: "I'm a developer",
    description: "Lead or join project squads and build your portfolio.",
    icon: CodeIcon,
  },
  {
    value: "client",
    title: "I'm a client",
    description: "Post projects and hire a Team Lead to deliver them.",
    icon: BriefcaseIcon,
  },
];

const subscribeNever = () => () => {};

/** False while the server-rendered HTML is still being hydrated, true afterwards. */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

type Props = { value: Role | null; onChange: (role: Role) => void; error?: string };

/** The one-time role choice. Team Lead isn't offered: it is per project. */
export function RoleChoice({ value, onChange, error }: Props) {
  // A click before hydration reaches no handler and is lost, so the choice stays
  // disabled until React is attached (slow on `next dev`, which compiles on demand).
  const hydrated = useHydrated();
  return (
    <fieldset className="space-y-3" aria-describedby={error ? "role-error" : "role-hint"}>
      <legend className="text-sm font-medium">
        How will you use NextNode? <span aria-hidden className="text-destructive">*</span>
      </legend>
      <p id="role-hint" className="text-xs text-muted-foreground">
        You choose this once. It can&apos;t be changed later.
      </p>
      {/* The submitted value comes from React state: a form reset after a
          failed submit clears Radix's own input but never this one. */}
      <input type="hidden" name="role" value={value ?? ""} />
      <RadioGroup
        value={value ?? ""}
        // React resets the form after each submit; Radix then reports "". Keep the choice.
        onValueChange={(next) => {
          if (next) onChange(next as Role);
        }}
        required
        disabled={!hydrated}
        aria-invalid={Boolean(error)}
        className="grid gap-3 sm:grid-cols-2"
      >
        {OPTIONS.map(({ value: option, title, description, icon: Icon }) => (
          <label
            key={option}
            htmlFor={`role-${option}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-accent/50",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              value === option && "border-highlight bg-accent/40",
            )}
          >
            <RadioGroupItem id={`role-${option}`} value={option} className="mt-1" />
            <span className="space-y-1">
              <span className="flex items-center gap-2 font-medium">
                <Icon className="size-4" aria-hidden />
                {title}
              </span>
              <span className="block text-sm text-muted-foreground">{description}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
      {error ? (
        <p id="role-error" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
