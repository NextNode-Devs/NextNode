import { InboxIcon } from "lucide-react";
import type { ReactNode } from "react";

import { ROLE_LABEL, type Account } from "@/entities/viewer";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import { SECTIONS, type SectionId, type SectionSpec } from "../model/sections";

type Props = {
  account: Account;
  /** Later issues pass their section content here; missing ones show their empty state. */
  sections?: Partial<Record<SectionId, ReactNode>>;
};

/** The signed-in home: role-aware sections that later issues fill. */
export function DashboardShell({ account, sections = {} }: Props) {
  const specs = SECTIONS[account.role];
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Badge variant="outline">{ROLE_LABEL[account.role]}</Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome, {account.display_name}</h1>
        <p className="text-muted-foreground">
          {account.role === "developer"
            ? "Things that need your attention as a developer."
            : "Things that need your attention on your projects."}
        </p>
      </header>

      <nav aria-label="Dashboard sections" className="-mx-1 overflow-x-auto">
        <ul className="flex gap-1 px-1">
          {specs.map((spec) => (
            <li key={spec.id}>
              <a
                href={`#${spec.id}`}
                className="inline-flex rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {spec.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid gap-4 md:grid-cols-2">
        {specs.map((spec) => (
          <Section key={spec.id} spec={spec}>
            {sections[spec.id]}
          </Section>
        ))}
      </div>
    </div>
  );
}

function Section({ spec, children }: { spec: SectionSpec; children?: ReactNode }) {
  return (
    <Card
      id={spec.id}
      aria-labelledby={`${spec.id}-title`}
      // The section links jump here; when every card already fits on screen the
      // jump can't scroll, so the chosen card is outlined to show where it went.
      className="scroll-mt-20 transition-shadow target:ring-2 target:ring-ring"
      role="region"
    >
      <CardHeader>
        <CardTitle>
          <h2 id={`${spec.id}-title`} className="text-base font-semibold">
            {spec.title}
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {children ?? (
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <InboxIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Nothing here yet. {spec.empty}{" "}
              <span className="text-xs">(Arrives with {spec.filledBy}.)</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
