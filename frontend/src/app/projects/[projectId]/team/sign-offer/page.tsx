import { LeadResignView } from "@/views/lead-resign";

export const metadata = { title: "Sign the offer" };

export default function Page({ params }: PageProps<"/projects/[projectId]/team/sign-offer">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return <LeadResignView projectId={params.then((p) => p.projectId)} />;
}
