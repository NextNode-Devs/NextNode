import { InviteLinkView } from "@/views/invite-link";

export const metadata = { title: "Team invite" };

export default function Page({ params }: PageProps<"/invite/[token]">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return <InviteLinkView token={params.then((p) => p.token)} />;
}
