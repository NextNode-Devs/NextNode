import { ArchiveIcon, LockIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getProject, type Project } from "@/entities/project";
import { getViewer, routeFor } from "@/entities/viewer";
import { authedServerApi } from "@/shared/api/server-client";
import { LoadError } from "@/shared/ui/load-states";
import { StateCard } from "@/shared/ui/molecules/state-card";
import { Button } from "@/shared/ui/shadcn/button";

export type ClosingViewer = "client" | "lead" | "member";

type Loaded = { ok: true; project: Project; viewer: ClosingViewer } | { ok: false; screen: ReactNode };

const projectsLink = (
  <Button asChild variant="outline">
    <Link href="/projects">Browse projects</Link>
  </Button>
);

/**
 * The real access check for the finishing screens (NN-17): signed in, the
 * project exists, it is a client project, and the viewer is its client, Team
 * Lead or a member. Anything else is drawn as a state screen.
 */
export async function loadClosingProject(rawId: string, path: string, what: string): Promise<Loaded> {
  const route = routeFor(await getViewer());
  if (route.kind === "sign-in") redirect(`/sign-in?redirect_url=/projects/${encodeURIComponent(rawId)}/${path}`);
  if (route.kind === "onboarding") redirect("/onboarding");
  if (route.kind === "error") return { ok: false, screen: <LoadError title={`We couldn't load ${what}`} message={route.message} /> };

  const numeric = /^\d+$/.test(rawId) ? Number(rawId) : null;
  const result = numeric ? await getProject(authedServerApi, numeric) : null;
  if (!result || (!result.ok && result.error.code === "NOT_FOUND")) {
    return {
      ok: false,
      screen: (
        <StateCard
          as="h1"
          icon={<SearchXIcon aria-hidden />}
          title="Project not found"
          message="This link doesn't match a project on NextNode."
          action={projectsLink}
        />
      ),
    };
  }
  if (!result.ok) {
    return {
      ok: false,
      screen:
        result.error.code === "FORBIDDEN" ? (
          <StateCard as="h1" icon={<LockIcon aria-hidden />} title="You can't view this project" message={result.error.message} action={projectsLink} />
        ) : (
          <LoadError title={`We couldn't load ${what}`} message={result.error.message} />
        ),
    };
  }

  const project = result.data;
  const backLink = (
    <Button asChild variant="outline">
      <Link href={`/projects/${project.id}`}>Back to the project</Link>
    </Button>
  );
  if (project.kind !== "client") {
    return {
      ok: false,
      screen: (
        <StateCard
          as="h1"
          icon={<ArchiveIcon aria-hidden />}
          title="Only client projects are approved and archived"
          message="A developer's own project has no client approval. Its Team Lead closes it instead."
          action={backLink}
        />
      ),
    };
  }
  const { is_owner, is_lead, is_member } = project.viewer;
  const viewer: ClosingViewer | null = is_owner ? "client" : is_lead ? "lead" : is_member ? "member" : null;
  if (!viewer) {
    return {
      ok: false,
      screen: (
        <StateCard
          as="h1"
          icon={<LockIcon aria-hidden />}
          title={`${what[0].toUpperCase()}${what.slice(1)} is private`}
          message="Only this project's client, Team Lead and team members can see it."
          action={backLink}
        />
      ),
    };
  }
  return { ok: true, project, viewer };
}
