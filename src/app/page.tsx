import { SiteCanvas } from "@/components/site-canvas";
import { getCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const catalog = await getCatalog();
  return <SiteCanvas key={view === "beats" || view === "loops" ? view : "home"} initialView={view === "beats" || view === "loops" ? view : "home"} beatTracks={catalog.beats} loopTracks={catalog.loops} catalogError={catalog.error} />;
}
