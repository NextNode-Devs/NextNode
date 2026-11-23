import { HireDevsView } from "@/views/hire-devs";

export const metadata = { title: "Hire developers" };

export default function Page({ params, searchParams }: PageProps<"/projects/[projectId]/hire-devs">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return <HireDevsView projectId={params.then((p) => p.projectId)} searchParams={searchParams} />;
}
