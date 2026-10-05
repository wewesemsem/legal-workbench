import { redirect } from "next/navigation";

export default async function MatterChatRedirectPage({
  params,
}: {
  params: Promise<{ matterId: string }>;
}) {
  const { matterId } = await params;
  redirect(`/app/matters/${matterId}/ai`);
}
