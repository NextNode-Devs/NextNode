import { HireDevelopersView } from "@/views/hire-developers";

export const metadata = { title: "Hire developers" };

export default function Page({ params }: PageProps<"/projects/[projectId]/hire">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return <HireDevelopersView projectId={params.then((p) => p.projectId)} />;
}
