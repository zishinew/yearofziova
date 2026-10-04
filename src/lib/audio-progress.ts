// Keep high-frequency progress updates outside React. Stop scheduling work when
// audio is paused, buffering, finished, or the tab is hidden.
export function watchAudioProgress(audio: HTMLAudioElement, update: (seconds: number) => void) {
  let frame: number | null = null;
  let buffering = false;
  function stop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }
  function canAnimate() {
    return !audio.paused && !audio.ended && !buffering && document.visibilityState !== "hidden";
  }
  function tick() {
    frame = null;
    update(audio.currentTime);
    if (canAnimate()) frame = requestAnimationFrame(tick);
  }
  function sync() {
    stop();
    update(audio.currentTime);
    if (canAnimate()) frame = requestAnimationFrame(tick);
  }
  function wait() { buffering = true; sync(); }
  function resume() { buffering = false; sync(); }
  const events = ["play", "pause", "ended", "timeupdate", "seeking", "seeked", "loadedmetadata", "error"];
  for (const event of events) audio.addEventListener(event, sync);
  audio.addEventListener("waiting", wait);
  audio.addEventListener("playing", resume);
  document.addEventListener("visibilitychange", sync);
  sync();
  return () => {
    stop();
    for (const event of events) audio.removeEventListener(event, sync);
    audio.removeEventListener("waiting", wait);
    audio.removeEventListener("playing", resume);
    document.removeEventListener("visibilitychange", sync);
  };
}
