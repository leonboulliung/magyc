import { SITE_MEDIA, type MediaKey } from "@/lib/siteMedia";
import { useT } from "@/components/i18n/LocaleProvider";
import { SiteImage } from "./SiteImage";
import { SiteVideo } from "./SiteVideo";
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
  const tr = useT();
  const localized = tr.marketing.media[media];
  const m = SITE_MEDIA[media];
  const alt = localized?.alt ?? m.alt;
  const label = localized?.label ?? m.label;
  if (m.src) {
    if (m.kind === "video") {
      return <SiteVideo src={m.src} alt={alt} ratio={ratio} caption={caption} className={className} posterSrc={m.posterSrc} />;
    }
    return <SiteImage src={m.src} alt={alt} ratio={ratio} caption={caption} className={className} priority={priority} sizes={sizes} />;
  }
  return <MediaPlaceholder label={label} ratio={ratio} caption={caption} className={className} />;
}
