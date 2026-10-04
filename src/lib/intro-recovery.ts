export type IntroPhase = "entering" | "center" | "docking" | "settled";

// CSS completion events can be skipped when a browser suspends a hidden tab.
export function watchIntroPhase(phase: IntroPhase, canvasReady: boolean, advance: (next: IntroPhase) => void) {
  if (phase === "settled") return () => {};
  const next = phase === "entering" ? "center" : phase === "center" ? "docking" : "settled";
  const delay = phase === "entering" ? 750 : phase === "center" ? (canvasReady ? 250 : 2000) : 1100;
  const deadline = Date.now() + delay;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    advance(next);
  };
  const resume = () => {
    if (document.visibilityState !== "hidden" && Date.now() >= deadline) finish();
  };
  const timer = window.setTimeout(finish, delay);
  window.addEventListener("focus", resume);
  document.addEventListener("visibilitychange", resume);
  return () => {
    finished = true;
    window.clearTimeout(timer);
    window.removeEventListener("focus", resume);
    document.removeEventListener("visibilitychange", resume);
  };
}
