import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { LoadingCards } from "@/shared/ui/load-states";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { AppHeader } from "@/widgets/app-header";
import { FinalApprovalPanel } from "@/widgets/project-closing";

import { loadClosingProject } from "./load-closing-project";

type Props = { projectId: Promise<string> };

/**
 * `/projects/[id]/final-approval` (Phase 2 prototype, NN-17 #97). Access is
 * real (the project's client, Team Lead and members); the milestones and the
 * final payment are sample data.
 */
export function FinalApprovalView({ projectId }: Props) {
  return (
    <>
      <AppHeader current="projects" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Suspense fallback={<LoadingCards count={2} label="Loading final approval" />}>
          <Screen projectId={projectId} />
        </Suspense>
      </main>
    </>
  );
}

async function Screen({ projectId }: Props) {
  const loaded = await loadClosingProject(await projectId, "final-approval", "final approval");
  if (!loaded.ok) return loaded.screen;
  const { project, viewer } = loaded;
  return (
    <div className="space-y-6">
      <Link
        href={`/projects/${project.id}`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> {project.title}
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Final approval</h1>
        <p className="text-muted-foreground">
          {viewer === "client"
            ? "Approve the finished project to pay the final payment and archive it."
            : "When every milestone is approved, the client approves the finished project and it's archived."}
        </p>
      </header>
      <PrototypeNotice>
        This screen shows sample milestones and payments, not this project&apos;s. Final approval is under construction:
        nothing is charged or archived.
      </PrototypeNotice>
      <FinalApprovalPanel projectId={project.id} viewer={viewer} />
    </div>
  );
}
