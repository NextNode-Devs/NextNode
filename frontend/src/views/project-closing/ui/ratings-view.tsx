import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { LoadingCards } from "@/shared/ui/load-states";
import { PrototypeNotice } from "@/shared/ui/molecules/prototype-notice";
import { AppHeader } from "@/widgets/app-header";
import { RatingsPanel } from "@/widgets/project-closing";

import { loadClosingProject } from "./load-closing-project";

type Props = { projectId: Promise<string> };

/**
 * `/projects/[id]/ratings` (Phase 2 prototype, NN-35 #98). Access is real
 * (the project's client, Team Lead and members); the people rated are sample data.
 */
export function RatingsView({ projectId }: Props) {
  return (
    <>
      <AppHeader current="projects" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Suspense fallback={<LoadingCards count={2} label="Loading ratings" />}>
          <Screen projectId={projectId} />
        </Suspense>
      </main>
    </>
  );
}

async function Screen({ projectId }: Props) {
  const loaded = await loadClosingProject(await projectId, "ratings", "ratings");
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
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ratings</h1>
        <p className="text-muted-foreground">
          {viewer === "client"
            ? "Rate your Team Lead and the team, once the project is completed."
            : viewer === "lead"
              ? "Rate each member, and write a Team Lead reference if you'd like."
              : "How you're rated on this project."}
        </p>
      </header>
      <PrototypeNotice>
        This screen shows sample people, not this project&apos;s team. Sending ratings is under construction and saves
        nothing.
      </PrototypeNotice>
      <RatingsPanel viewer={viewer} />
    </div>
  );
}
