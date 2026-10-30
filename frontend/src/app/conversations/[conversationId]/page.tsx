import { ConversationsView } from "@/views/conversations";

export const metadata = { title: "Conversation" };

export default function Page({ params }: PageProps<"/conversations/[conversationId]">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return <ConversationsView conversationId={params.then((p) => p.conversationId)} />;
}
