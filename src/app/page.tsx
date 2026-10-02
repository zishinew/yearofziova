import { SiteCanvas } from "@/components/site-canvas";
import { getCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const catalog = await getCatalog();
  return <SiteCanvas beatTracks={catalog.beats} loopTracks={catalog.loops} catalogError={catalog.error} />;
}
