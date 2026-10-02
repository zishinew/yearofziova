import { PixelLiquidBg } from "@/components/ui/pixel-liquid-bg";
import { WelcomeGate } from "@/components/welcome-gate";

export default function Home() {
  return (
    <WelcomeGate>
      <main className="fixed inset-0 overflow-hidden bg-white">
        <PixelLiquidBg pixelSize={8} />
      </main>
    </WelcomeGate>
  );
}
