import { PresetBuilder } from "@/components/studio/PresetBuilder";

/**
 * Presets — reusable project starters. The builder lets the photographer curate
 * which elements + prompt rules seed a new project. Storage + API
 * (/api/studio/presets) intact; restored after the account-area UI rebuild.
 */
export default function StudioPresetsPage() {
  return <PresetBuilder />;
}
