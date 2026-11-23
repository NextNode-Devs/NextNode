import type { TeamChange } from "@/entities/team";
import { formatMessageTime } from "@/shared/lib/format-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

/** Every team change, newest first. Each one was sent to the whole team and the client. */
export function TeamHistory({ history }: { history: TeamChange[] }) {
  const newest = [...history].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <h2>Team changes</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3 border-l pl-4">
          {newest.map((change) => (
            <li key={change.id} className="relative text-sm">
              <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-muted-foreground" aria-hidden />
              <p className="text-xs text-muted-foreground">
                <time dateTime={change.at}>{formatMessageTime(change.at)}</time>
              </p>
              <p>{change.text}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
