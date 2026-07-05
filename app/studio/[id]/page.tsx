import { redirect } from "next/navigation";

// Project workspaces moved to /project/[id]. Keep /studio/[id] as a permanent
// redirect so old links, bookmarks and shared workspace URLs keep working.
export default async function StudioProjectRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/project/${id}`);
}
