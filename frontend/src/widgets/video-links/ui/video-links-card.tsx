import { VideoIcon } from "lucide-react";
import type { ReactNode } from "react";

import { groupVideoLinks, type OneOffLink, type VideoLink } from "@/entities/video-link";
import { formatMonthYear, monthKeyOf } from "@/shared/lib/format-date";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { SectionRule } from "@/shared/ui/molecules/section-rule";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import { MeetingRow } from "./meeting-row";

type Props = {
  links: readonly VideoLink[];
  /** Server time (ISO), so "upcoming" and "past" match on server and browser. */
  now: string;
};

function List({ children }: { children: ReactNode }) {
  return <ul className="divide-y overflow-hidden rounded-lg border">{children}</ul>;
}

function byMonth(links: OneOffLink[]): { key: string; label: string; links: OneOffLink[] }[] {
  const months: { key: string; label: string; links: OneOffLink[] }[] = [];
  for (const link of links) {
    const key = monthKeyOf(link.schedule.starts_at);
    const month = months.find((m) => m.key === key);
    if (month) month.links.push(link);
    else months.push({ key, label: formatMonthYear(link.schedule.starts_at), links: [link] });
  }
  return months;
}

/** The workspace's meeting links: recurring, upcoming, then past meetings by month. */
export function VideoLinksCard({ links, now }: Props) {
  const { recurring, upcoming, past } = groupVideoLinks(links, now);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <h2>Meetings</h2>
          <PrototypeBadge />
        </CardTitle>
        <CardDescription>Meeting links for the client and team. Calls happen in Zoom, Google Meet or Teams, outside NextNode.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {links.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
            <VideoIcon className="size-5 text-muted-foreground" aria-hidden />
            <p className="font-medium">No meeting links yet</p>
            <p className="text-sm text-muted-foreground">Add one, and everyone on the project can join from here.</p>
          </div>
        ) : null}

        {recurring.length > 0 ? (
          <section aria-labelledby="recurring-meetings" className="space-y-2">
            <h3 id="recurring-meetings" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Recurring
            </h3>
            <List>
              {recurring.map((link) => (
                <MeetingRow key={link.id} link={link} />
              ))}
            </List>
          </section>
        ) : null}

        {upcoming.length > 0 ? (
          <section aria-labelledby="upcoming-meetings" className="space-y-2">
            <h3 id="upcoming-meetings" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Upcoming
            </h3>
            <List>
              {upcoming.map((link) => (
                <MeetingRow key={link.id} link={link} />
              ))}
            </List>
          </section>
        ) : null}

        {past.length > 0 ? (
          <details open className="group">
            <summary className="cursor-pointer rounded-sm text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              Past meetings ({past.length})
            </summary>
            <div className="mt-1">
              {byMonth(past).map((month) => (
                <section key={month.key} aria-label={`Past meetings, ${month.label}`}>
                  <SectionRule as="h4">{month.label}</SectionRule>
                  <List>
                    {month.links.map((link) => (
                      <MeetingRow key={link.id} link={link} past />
                    ))}
                  </List>
                </section>
              ))}
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
