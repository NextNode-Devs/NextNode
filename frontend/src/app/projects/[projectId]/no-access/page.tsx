import { AccessRemovedView } from "@/views/project-access-removed";

export const metadata = { title: "No access" };

export default function Page({ params, searchParams }: PageProps<"/projects/[projectId]/no-access">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return (
    <AccessRemovedView projectId={params.then((p) => p.projectId)} reason={searchParams.then((s) => s.reason)} />
  );
}
