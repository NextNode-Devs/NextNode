import { RatingsView } from "@/views/project-closing";

export const metadata = { title: "Ratings" };

export default function Page({ params }: PageProps<"/projects/[projectId]/ratings">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return <RatingsView projectId={params.then((p) => p.projectId)} />;
}
