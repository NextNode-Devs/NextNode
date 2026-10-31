import { ProjectSearchView } from "@/views/project-search";

export const metadata = { title: "Projects" };

export default function Page({ searchParams }: PageProps<"/projects">) {
  // Read inside the view's Suspense boundary, so the page shell renders at once.
  return <ProjectSearchView searchParams={searchParams} />;
}
