import { DeveloperDirectoryView } from "@/views/developer-directory";

export const metadata = { title: "Developers" };

export default function Page({ searchParams }: PageProps<"/developers">) {
  // Read inside the view's Suspense boundary, so the page shell renders at once.
  return <DeveloperDirectoryView searchParams={searchParams} />;
}
