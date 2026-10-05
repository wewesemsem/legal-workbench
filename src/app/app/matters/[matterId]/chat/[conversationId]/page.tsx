import { redirect } from "next/navigation";

export default async function MatterChatConversationRedirectPage({
  params,
}: {
  params: Promise<{ matterId: string; conversationId: string }>;
}) {
  const { matterId } = await params;
  redirect(`/app/matters/${matterId}/ai`);
}
