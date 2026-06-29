import { SITE_MEDIA, type MediaKey } from "@/lib/siteMedia";
import { SiteImage } from "./SiteImage";
import { MediaPlaceholder } from "./MediaPlaceholder";

/**
 * MediaFrame — renders a registry media slot. If `src` is set in the registry
 * it shows the real image; otherwise a clearly-labelled placeholder in the same
 * framed box, so dropping in real footage later needs no layout change.
 */
export function MediaFrame({
  media,
  ratio = "16 / 10",
  caption,
  className,
  priority,
  sizes,
}: {
  media: MediaKey;
  ratio?: string;
  caption?: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const m = SITE_MEDIA[media];
  if (m.src) {
    return <SiteImage src={m.src} alt={m.alt} ratio={ratio} caption={caption} className={className} priority={priority} sizes={sizes} />;
  }
  return <MediaPlaceholder label={m.label} ratio={ratio} caption={caption} className={className} />;
}
