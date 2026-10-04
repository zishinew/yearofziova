import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/intro-recovery.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { watchIntroPhase } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function browser(t) {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  let now = 0;
  let timerId = 0;
  const timers = new Map();
  const window = new EventTarget();
  const document = new EventTarget();
  document.visibilityState = "visible";
  window.setTimeout = (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; };
  window.clearTimeout = id => timers.delete(id);
  globalThis.window = window;
  globalThis.document = document;
  t.mock.method(Date, "now", () => now);
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  });
  return { window, document, timers, elapsed: value => { now = value; } };
}

test("intro reaches settled even if animation events and background readiness never arrive", t => {
  const fixture = browser(t);
  let phase = "entering";
  for (const expected of ["center", "docking", "settled"]) {
    const cleanup = watchIntroPhase(phase, false, next => { phase = next; });
    const timer = [...fixture.timers.values()][0];
    assert.ok(timer);
    timer.callback();
    assert.equal(phase, expected);
    cleanup();
    assert.equal(fixture.timers.size, 0);
  }
  const cleanup = watchIntroPhase(phase, true, () => assert.fail("Settled intro must not restart"));
  assert.equal(fixture.timers.size, 0);
  fixture.window.dispatchEvent(new Event("focus"));
  cleanup();
});

test("returning to a visible tab recovers an overdue phase without waiting for a suspended timer", t => {
  const fixture = browser(t);
  const advances = [];
  const cleanup = watchIntroPhase("docking", true, next => advances.push(next));
  fixture.document.visibilityState = "hidden";
  fixture.elapsed(5000);
  fixture.document.dispatchEvent(new Event("visibilitychange"));
  assert.deepEqual(advances, []);
  fixture.document.visibilityState = "visible";
  fixture.document.dispatchEvent(new Event("visibilitychange"));
  fixture.window.dispatchEvent(new Event("focus"));
  [...fixture.timers.values()][0].callback();
  assert.deepEqual(advances, ["settled"]);
  cleanup();
});

test("normal motion retains its timing and cleanup prevents stale phase changes", t => {
  const fixture = browser(t);
  const advances = [];
  const cleanup = watchIntroPhase("center", true, next => advances.push(next));
  const timer = [...fixture.timers.values()][0];
  assert.equal(timer.delay, 250);
  fixture.elapsed(100);
  fixture.window.dispatchEvent(new Event("focus"));
  assert.deepEqual(advances, []);
  cleanup();
  fixture.elapsed(5000);
  fixture.document.dispatchEvent(new Event("visibilitychange"));
  timer.callback();
  assert.deepEqual(advances, []);
});
