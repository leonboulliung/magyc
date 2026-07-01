import { redirect } from "next/navigation";

/**
 * `/showcase` has no curated public example spaces yet (BACKLOG #15). The
 * previous target `/#work` was a dead anchor — no element with that id exists,
 * and the home renders inside a fixed inner-scroll container where a URL hash
 * cannot scroll anyway — so the prominent "Beispiel ansehen" CTAs landed inert
 * at the top of the page. Until real example projects are curated, send the
 * visitor to the walkthrough, which shows the product on a concrete project.
 */
export default function ShowcaseRedirect() {
  redirect("/how-it-works");
}
