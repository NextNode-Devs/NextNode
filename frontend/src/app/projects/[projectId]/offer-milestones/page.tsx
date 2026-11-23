import { OfferMilestonesView } from "@/views/offer-milestones";

export const metadata = { title: "Offer milestones" };

export default function Page({ params }: PageProps<"/projects/[projectId]/offer-milestones">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return <OfferMilestonesView projectId={params.then((p) => p.projectId)} />;
}
