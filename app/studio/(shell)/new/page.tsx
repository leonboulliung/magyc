import { redirect } from "next/navigation";

/** Project creation now lives on the prompt-first Studio dashboard. */
export default function NewProjectPage() {
  redirect("/studio");
}
