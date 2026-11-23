import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { SAMPLE_ARCHIVED_CONVERSATIONS, sampleClosing } from "@/entities/project";
import { LoadingCards } from "@/shared/ui/load-states";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { Badge } from "@/shared/ui/shadcn/badge";
import { AppHeader } from "@/widgets/app-header";
import { ArchivedProject } from "@/widgets/project-closing";

import { loadClosingProject, type ClosingViewer } from "./load-closing-project";

type Props = { projectId: Promise<string>; confidential: Promise<boolean> };

/** The client isn't in the team chat; members aren't in the client's conversation with the Lead (#6). */
const SEES: Record<ClosingViewer, string[]> = {
  client: ["client-lead"],
  lead: ["client-lead", "team"],
  member: ["team"],
};

/**
 * `/projects/[id]/archived` (Phase 2 prototype, NN-17 #97): how a client
 * project looks once archived. Access is real; the record is sample data.
 * `?confidential=1` shows the sample as a confidential project.
 */
export function ArchivedProjectView(props: Props) {
  return (
    <>
      <AppHeader current="projects" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Suspense fallback={<LoadingCards count={2} label="Loading the archived project" />}>
          <Screen {...props} />
        </Suspense>
      </main>
    </>
  );
}

async function Screen({ projectId, confidential }: Props) {
  const loaded = await loadClosingProject(await projectId, "archived", "the archived project");
  if (!loaded.ok) return loaded.screen;
  const { project, viewer } = loaded;
  const closing = sampleClosing("archived", project.id, await confidential);
  return (
    <div className="space-y-6">
      <Link
        href={`/projects/${project.id}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Back to the project
      </Link>
      <header className="space-y-2">
        <Badge variant="secondary">Archived</Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{project.title}</h1>
      </header>
      <PrototypeNotice>
        A preview of this project once it&apos;s archived, with sample conversations, milestones and payments. It
        isn&apos;t archived yet.
      </PrototypeNotice>
      <ArchivedProject
        closing={closing}
        conversations={SAMPLE_ARCHIVED_CONVERSATIONS.filter((c) => SEES[viewer].includes(c.id))}
      />
    </div>
  );
}
