/*
 * Oscillator detune at k-rate, on the mock WebAudio of tests/harness.js, for both builds:
 *   - every oscillator a note makes (melodic and percussion, both quality modes) has its
 *     detune, which the channel's vibrato feeds, at automationRate "k-rate"; the oscillators
 *     with no detune input (the LFO, playMIDI's silent start-up oscillator) and buffer sources
 *     keep the default;
 *   - a context whose AudioParams have no automationRate (Firefox), or one whose rate cannot
 *     change (the assignment throws), still plays the note with its detune connected.
 * The mock's automationRate is a plain property, not a recorded call, so the rate is read on
 * the nodes captured here.
 */
import vm from "node:vm";
import { describe, expect, test } from "vitest";
import { H, variants } from "./helpers.mjs";

const calls = (trace, from = 0) => trace.slice(from).map((line) => JSON.parse(line));

/*
 * A synth in a fresh mock environment, with every oscillator and buffer source it creates
 * captured in creation order. `param(node)`, when given, runs on each new oscillator.
 */
function make(variant, opts = {}, param) {
  const trace = [];
  const env = H.createEnvironment(trace);
  vm.runInContext(variant.source, env.sandbox, { filename: variant.name });
  const Base = env.sandbox.AudioContext;
  const oscs = [], bufs = [];
  for (const [m, list] of [["createOscillator", oscs], ["createBufferSource", bufs]]) {
    const create = Base.prototype[m];
    Base.prototype[m] = function () {
      const node = create.call(this);
      if (param && list === oscs) param(node);
      list.push(node);
      return node;
    };
  }
  const synth = new env.sandbox.WebAudioTinySynth(opts);
  return { env, trace, synth, oscs, bufs };
}

/* The ids of the parameters something is connected to in trace[from..]. */
const connectedParams = (trace, from = 0) => new Set(calls(trace, from).filter(([op]) => op === "connect").map(([, , to]) => to));

describe.each(variants)("$name", (variant) => {
  describe.each([0, 1])("quality %i", (quality) => {
    test("every note oscillator's detune is k-rate; the LFO, the start-up oscillator and buffer sources keep the default", () => {
      const s = make(variant, { quality, useReverb: 0 });
      const melodic = s.oscs.length, melodicBufs = s.bufs.length;
      for (let p = 0; p < 128; ++p) {
        s.synth.setProgram(0, p);
        s.synth.noteOn(0, 60, 100);
        s.synth.noteOff(0, 60);
      }
      const drums = s.oscs.length, drumBufs = s.bufs.length;
      for (let n = 35; n <= 81; ++n) s.synth.noteOn(9, n, 100);
      const voices = s.oscs.slice(melodic, drums), hits = s.oscs.slice(drums);
      expect(voices.length + drumBufs - melodicBufs).toBeGreaterThanOrEqual(128); // a source per program at least
      expect(voices.length).toBeGreaterThan(0);
      expect(hits.length).toBeGreaterThan(0);
      expect(s.bufs.length).toBeGreaterThan(drumBufs); // the noise drums
      for (const o of [...voices, ...hits]) expect(o.detune.automationRate).toBe("k-rate");
      for (const b of s.bufs) expect(b.detune.automationRate).toBe("a-rate"); // untouched (k-rate by spec in a browser)

      // Exactly the oscillators whose detune is connected (to the channel's vibrato) are k-rate.
      const from = s.trace.length;
      s.synth.loadMIDI(H.toArrayBuffer(H.makeMidi(480, [{ tick: 0, bytes: [0x90, 60, 100] }, { tick: 480, bytes: [0x80, 60, 0] }])));
      s.synth.playMIDI();
      H.runUntil(s.env, () => false, 200);
      const dummy = s.oscs.find((o) => o.frequency.value === 0);
      expect(dummy).toBeDefined();
      expect(s.oscs).toContain(s.synth.lfo);
      const connected = connectedParams(s.trace);
      for (const o of s.oscs) expect([o.detune.automationRate, connected.has(o.detune._id)]).toEqual(connected.has(o.detune._id) ? ["k-rate", true] : ["a-rate", false]);
      expect([s.synth.lfo.detune.automationRate, dummy.detune.automationRate]).toEqual(["a-rate", "a-rate"]);
      expect(connectedParams(s.trace, from).size).toBeGreaterThan(0);
    });
  });

  /* The note's oscillator: started, its frequency set, its detune connected and set to the bend. */
  function played(s, ch, n) {
    const nt = s.synth.notetab.filter((v) => v.ch === ch && v.n === n).pop();
    expect(nt).toBeDefined();
    const o = nt.o[0], c = calls(s.trace);
    expect(c.some(([op, id]) => op === "start" && id === o._id)).toBe(true);
    expect(c.some(([op, , to]) => op === "connect" && to === o.detune._id)).toBe(true);
    expect(o.detune.value).toBe(s.synth.bend[ch]);
    return o;
  }

  test("a context whose AudioParams have no automationRate (Firefox) plays the note as before", () => {
    const s = make(variant, {}, (node) => { delete node.detune.automationRate; });
    s.synth.setBend(0, 12288);
    expect(() => s.synth.noteOn(0, 64, 100)).not.toThrow();
    played(s, 0, 64);
  });

  test("a detune whose rate cannot change (the assignment throws) plays the note as before", () => {
    const s = make(variant, {}, (node) => {
      Object.defineProperty(node.detune, "automationRate", { get: () => "a-rate", set: () => { throw new Error("InvalidStateError"); } });
    });
    s.synth.setBend(0, 4096);
    expect(() => s.synth.noteOn(0, 64, 100)).not.toThrow();
    expect(played(s, 0, 64).detune.automationRate).toBe("a-rate");
  });

  test("a getter-only automationRate (strict-mode assignment throws a TypeError) plays the note as before", () => {
    const s = make(variant, {}, (node) => {
      Object.defineProperty(node.detune, "automationRate", { get: () => "a-rate" });
    });
    expect(() => s.synth.noteOn(0, 64, 100)).not.toThrow();
    expect(played(s, 0, 64).detune.automationRate).toBe("a-rate");
  });
});
