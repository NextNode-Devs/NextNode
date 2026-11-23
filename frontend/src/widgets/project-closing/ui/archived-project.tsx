import { ArchiveIcon, LockIcon, MessagesSquareIcon } from "lucide-react";

import {
  approvedMilestones,
  LegalTerms,
  type ArchivedConversation,
  type ProjectClosing,
} from "@/entities/project";
import { formatMessageTime, formatMomentDate } from "@/shared/lib/format-date";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import { MilestoneChecklist, PaymentSummary } from "./closing-parts";
import { DownloadArchiveButton } from "./download-archive-button";

type Props = {
  closing: ProjectClosing;
  /** Only the conversations this viewer was part of. */
  conversations: ArchivedConversation[];
};

/**
 * An archived client project (NN-17, prototype): read-only for everyone.
 * Conversations stay readable but greyed, with the composer closed.
 */
export function ArchivedProject({ closing, conversations }: Props) {
  return (
    <div className="space-y-6">
      <Alert>
        <ArchiveIcon aria-hidden />
        <AlertTitle>Archived on {formatMomentDate(closing.archived_at)} · read-only</AlertTitle>
        <AlertDescription>
          The client gave final approval. Everything stays readable, but nothing in this project can be changed.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section aria-labelledby="archived-conversations" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="archived-conversations" className="text-lg font-semibold">
                Conversations
              </h2>
              <PrototypeBadge />
            </div>
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">You weren&apos;t part of any conversation in this project.</p>
            ) : (
              conversations.map((c) => <ArchivedConversationCard key={c.id} conversation={c} />)
            )}
          </section>
          <MilestoneChecklist closing={closing} />
        </div>
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <h2>Project record</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <Fact term="Final approval" value={formatMomentDate(closing.final_approved_at)} />
                <Fact
                  term="Milestones"
                  value={`${approvedMilestones(closing)} of ${closing.milestones.length} approved`}
                />
                <Fact term="Team" value={<Badge variant="secondary">Archived</Badge>} />
                <Fact
                  term="Portfolios"
                  value={closing.confidential ? "Confidential: kept off portfolios" : "Listed under \"Shipped projects\""}
                />
              </dl>
              <div className="mt-4">
                <DownloadArchiveButton />
              </div>
            </CardContent>
          </Card>
          <PaymentSummary closing={closing} paid />
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                <h2>Code ownership</h2>
              </CardTitle>
              <PrototypeBadge />
            </CardHeader>
            <CardContent>
              <LegalTerms layout="stacked" confidential={closing.confidential} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Fact({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function ArchivedConversationCard({ conversation }: { conversation: ArchivedConversation }) {
  const noteId = `archived-${conversation.id}-note`;
  return (
    <Card aria-labelledby={`archived-${conversation.id}-title`} role="region" className="bg-muted/40">
      <CardHeader className="gap-1">
        <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
          <MessagesSquareIcon aria-hidden className="size-4" />
          <h3 id={`archived-${conversation.id}-title`}>{conversation.title}</h3>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{conversation.audience}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-2 text-muted-foreground">
          {conversation.messages.map((m) => (
            <li key={m.id} className="rounded-md border border-dashed bg-background/60 px-3 py-2 text-sm">
              <p className="text-xs">
                <span className="font-medium">{m.author_name}</span> ·{" "}
                <time dateTime={m.sent_at}>{formatMessageTime(m.sent_at)}</time>
              </p>
              <p>{m.body}</p>
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-2">
          <label htmlFor={`archived-${conversation.id}-input`} className="sr-only">
            Message {conversation.title}
          </label>
          <input
            id={`archived-${conversation.id}-input`}
            disabled
            aria-describedby={noteId}
            placeholder="Read-only"
            className="h-10 min-w-0 flex-1 cursor-not-allowed rounded-md border bg-muted px-3 text-sm opacity-60"
          />
        </div>
        <p id={noteId} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <LockIcon aria-hidden className="size-3.5" />
          This project is archived, so nobody can send new messages.
        </p>
      </CardContent>
    </Card>
  );
}
