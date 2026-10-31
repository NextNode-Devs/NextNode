import { EditProjectView } from "@/views/project-editor";

export const metadata = { title: "Edit project" };

export default function Page({ params }: PageProps<"/projects/[projectId]/edit">) {
  return <EditProjectView projectId={params.then((p) => p.projectId)} />;
}
