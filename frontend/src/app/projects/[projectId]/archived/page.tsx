import { ArchivedProjectView } from "@/views/project-closing";

export const metadata = { title: "Archived project" };

export default function Page({ params, searchParams }: PageProps<"/projects/[projectId]/archived">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return (
    <ArchivedProjectView
      projectId={params.then((p) => p.projectId)}
      confidential={searchParams.then((s) => s.confidential === "1")}
    />
  );
}
