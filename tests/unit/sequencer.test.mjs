/*
 * MIDI file playback: event order and timing. Each note-on starts one sound
 * source; its start time and pitch are compared with the tempo map and note
 * numbers of a generated file.
 */
import { describe, expect, test } from "vitest";
import { H, variants, synthFor, sources, noteHz, secondsAt, makeMidiFormat1, playToEnd, programChange } from "./helpers.mjs";

const PPQ = 480;
const sine = () => [{ w: "sine", t: 1, f: 0, v: 0.5, d: 0.1, s: 0.5, r: 0.1 }];
const square = () => [{ w: "square", t: 1, f: 0, v: 0.5, d: 0.1, s: 0.5, r: 0.1 }];

describe.each(variants)("$name: MIDI file playback", (variant) => {
  test("note-ons follow a fractional tempo map", () => {
    // 455,000 us = 131.868... BPM, then 470,000 us = 127.659... BPM from beat 4.
    const tempos = [[0, 455000], [4 * PPQ, 470000]];
    const ticks = [0, 240, 493, 1000, 1920, 2133, 2400, 3847];
    const events = tempos.map(([tick, us]) => H.midi.tempo(tick, us));
    ticks.forEach((tick, i) => events.push(H.midi.noteOn(tick, 0, 60 + i, 100), H.midi.noteOff(tick + 100, 0, 60 + i)));
    const s = synthFor(variant);
    s.synth.setTimbre(0, 0, sine());
    const from = s.trace.length;
    playToEnd(s, H.makeMidi(PPQ, events));

    const played = sources(s.trace, from);
    expect(played).toHaveLength(ticks.length);
    played.forEach((src, i) => {
      expect(src.freq).toBeCloseTo(noteHz(60 + i), 9);
      expect(src.start - played[0].start).toBeCloseTo(secondsAt(PPQ, tempos, ticks[i]), 9);
    });
  });

  test("notes from several tracks play in time order", () => {
    // Format 1, no tempo event: the MIDI default of 120 BPM, so 480 ticks = 0.5 s.
    const trackA = [[0, 60], [960, 62], [1920, 64]].map(([tick, n]) => [H.midi.noteOn(tick, 0, n, 100), H.midi.noteOff(tick + 240, 0, n)]).flat();
    const trackB = [[480, 61], [1440, 63]].map(([tick, n]) => [H.midi.noteOn(tick, 1, n, 100), H.midi.noteOff(tick + 240, 1, n)]).flat();
    const s = synthFor(variant);
    s.synth.setTimbre(0, 0, sine());
    const from = s.trace.length;
    playToEnd(s, makeMidiFormat1(PPQ, [trackA, trackB]));

    const played = sources(s.trace, from);
    expect(played.map((src) => src.freq)).toEqual([60, 61, 62, 63, 64].map(noteHz));
    expect(played.map((src) => src.start - played[0].start)).toEqual([0, 0.5, 1, 1.5, 2].map((x) => expect.closeTo(x, 9)));
  });

  test("events at the same tick take effect in file order", () => {
    const events = [
      programChange(0, 0, 1), H.midi.noteOn(0, 0, 60, 100),    // program first: the note uses program 1
      H.midi.noteOn(480, 0, 62, 100), programChange(480, 0, 0), // note first: it still uses program 1
      H.midi.noteOn(960, 0, 64, 100),                           // program 0 from here on
      H.midi.noteOff(1200, 0, 60), H.midi.noteOff(1200, 0, 62), H.midi.noteOff(1200, 0, 64),
    ];
    const s = synthFor(variant);
    s.synth.setTimbre(0, 0, sine());
    s.synth.setTimbre(0, 1, square());
    const from = s.trace.length;
    playToEnd(s, H.makeMidi(PPQ, events));

    expect(sources(s.trace, from).map((src) => src.type)).toEqual(["square", "square", "sine"]);
  });
});

describe.each(variants)("$name: a 1 s lookahead (touch devices)", (variant) => {
  /* Melodic voices sounding at time x: a voice cut ahead (_cut) ends at its cut. */
  const sounding = (synth, x) => synth.notetab.filter((v) => v.t <= x && x < v.e).length;

  /* Play `events` with preroll 1, recording each voice pruned (whether it had started, and
     whether it was still sounding: not ended and the song still playing), each voice cut ahead,
     each release, and the most voices queued, and sounding, at once. */
  function play(events, opts) {
    const s = synthFor(variant, opts);
    s.synth.preroll = 1;
    const now = () => s.env.clock.ms / 1000;
    const pruned = [], prune = s.synth._pruneNote;
    s.synth._pruneNote = (nt) => { pruned.push({ started: nt.t <= now(), live: nt.e >= now() && s.synth.playing === 1 }); return prune(nt); };
    const cut = [], cutNote = s.synth._cut;
    s.synth._cut = (nt, t) => { cut.push({ at: now(), t, start: nt.t }); return cutNote(nt, t); };
    const released = [], release = s.synth._releaseNote;
    s.synth._releaseNote = (nt, t) => { released.push({ at: now(), t }); return release(nt, t); };
    let queued = 0, peak = 0;
    const step = s.env.step;
    s.env.step = () => { step(); queued = Math.max(queued, s.synth.notetab.length); peak = Math.max(peak, sounding(s.synth, now())); };
    playToEnd(s, H.makeMidi(PPQ, events));
    return { s, pruned, cut, released, queued, peak };
  }

  test("voices queued ahead are neither stolen before they start nor counted against the limit", () => {
    // 8-note chords every 0.1 s (96 ticks at 120 BPM), each released after 0.05 s: about 80
    // voices queued ahead, more than the 64-voice limit, while far fewer sound at once.
    const events = [];
    for (let i = 0; i < 40; ++i)
      for (let k = 0; k < 8; ++k)
        events.push(H.midi.noteOn(i * 96, 0, 48 + k * 3, 100), H.midi.noteOff(i * 96 + 48, 0, 48 + k * 3));
    const { s, pruned, cut, queued, peak } = play(events);
    expect(s.synth.voices).toBe(64);
    expect(queued).toBeGreaterThan(64);
    expect(peak).toBeLessThanOrEqual(64);
    expect(cut).toEqual([]);
    expect(pruned.filter((p) => !p.started)).toEqual([]);
    expect(pruned.filter((p) => p.live)).toEqual([]);
  });

  test("a chord queued ahead that exceeds the limit is held to it from its onset, and the voice table to the limit", () => {
    // 300 notes at once, held for 0.5 s: the 236 over the limit at their own onset would never
    // sound, so they go when queued, as upstream; init's released note is cut at the onset.
    const events = [];
    for (let k = 0; k < 300; ++k)
      events.push(H.midi.noteOn(0, 0, 20 + (k % 100), 100), H.midi.noteOff(480, 0, 20 + (k % 100)));
    const { pruned, cut, peak, queued } = play(events);
    expect([peak, queued]).toEqual([64, 64]);
    expect(pruned.filter((p) => !p.started)).toHaveLength(236);
    expect(cut.every((c) => c.start < c.t && c.at < c.t)).toBe(true); // none at its own onset
  });

  test("a caller's notes sent with a future time are limited when sent, as upstream", () => {
    const { synth } = synthFor(variant, { voices: 3 });
    synth.preroll = 1;
    for (let n = 60; n < 72; ++n) synth.noteOn(0, n, 100, 0.5);
    expect([sounding(synth, 0.5), synth.notetab.length]).toEqual([3, 3]);
  });

  test("a live note never cuts a queued voice; held into a queued onset, it is counted at the next one", () => {
    const { synth, env } = synthFor(variant, { voices: 3 });
    synth.preroll = 1;
    synth.loadMIDI(H.toArrayBuffer(H.makeMidi(PPQ, [
      ...[60, 64, 67].map((n) => H.midi.noteOn(480, 0, n, 100)), H.midi.noteOn(1440, 0, 72, 100),
      ...[60, 64, 67, 72].map((n) => H.midi.noteOff(1920, 0, n)),
    ])));
    synth.playMIDI();
    env.step(); // the chord at 0.5 s is queued, the note at 1.5 s not yet
    synth.noteOn(1, 50, 100); // a live note, held
    const onset = (n) => synth.notetab.find((nt) => nt.n === n).t;
    expect(synth.notetab.filter((nt) => nt.ch === 0 && nt.x === undefined)).toHaveLength(3); // no chord note is cut for it
    expect(sounding(synth, onset(60))).toBe(4);
    H.runUntil(env, () => synth.notetab.some((nt) => nt.n === 72), 2000);
    expect(sounding(synth, onset(72))).toBe(3);
  });

  test("a caller's notes scheduled ahead, within the lookahead or beyond, keep the voice table bounded", () => {
    // 4000 notes, 2000 within the 1 s lookahead and 2000 from 1 s on, sent track by track
    // (every other note, then the rest).
    const { synth } = synthFor(variant, { quality: 0 });
    synth.preroll = 1;
    let most = 0;
    for (let j = 0; j < 4000; ++j) {
      const i = (j % 2) * 2000 + (j >> 1), t = i < 2000 ? 0.1 + i * 0.0004 : 1 + (i - 2000) * 0.05;
      synth.noteOn(0, 40 + (i % 40), 100, t);
      synth.noteOff(0, 40 + (i % 40), t + 0.1);
      most = Math.max(most, synth.notetab.length);
    }
    expect(most).toBeLessThanOrEqual(64);
  });

  test("an All Notes Off sent ahead releases the channel at its own time, not when it is sent", () => {
    // Note-off at 0.4 s, CC123 at 0.5 s (tick 480), and a note held into the CC123 on channel 1.
    const { s, pruned, released } = play([
      H.midi.noteOn(0, 0, 60, 100), H.midi.noteOff(384, 0, 60),
      H.midi.noteOn(0, 1, 64, 100), { tick: 480, bytes: [0xb0, 123, 0] }, { tick: 480, bytes: [0xb1, 123, 0] },
    ]);
    const start = released[0].t - 0.4;
    expect(pruned.filter((p) => p.live)).toEqual([]);
    expect(released.map((r) => r.t - start)).toEqual([0.4, 0.5].map((x) => expect.closeTo(x, 9))); // the released note is not released again
    expect(released.every((r) => r.at < r.t)).toBe(true); // sent ahead, within the lookahead
    expect(s.synth.notetab).toEqual([]);
  });

  test("a Reset All Controllers sent ahead lifts the pedal at its time, releasing what it held", () => {
    // Note-on at 0, pedal down at 0.1 s, CC123 at 0.2 s, CC121 at 0.3 s, note-off at 0.5 s.
    const { s, released } = play([
      H.midi.noteOn(0, 0, 60, 100), { tick: 96, bytes: [0xb0, 64, 127] },
      { tick: 192, bytes: [0xb0, 123, 0] }, { tick: 288, bytes: [0xb0, 121, 0] }, H.midi.noteOff(480, 0, 60),
    ]);
    const start = s.notes.find(([, ch, n]) => ch === 0 && n === 60)[0];
    expect(released.map((r) => r.t - start)).toEqual([expect.closeTo(0.3, 9)]);
    expect([s.synth.sustain[0], s.synth.notetab]).toEqual([0, []]);
  });

  test("an All Notes Off sent ahead leaves a sustained note to the pedal, as a note-off does", () => {
    // Note-on at 0, pedal down at 0.1 s, CC123 at 0.2 s, pedal up at 2 s.
    const { s, released } = play([
      H.midi.noteOn(0, 0, 60, 100), { tick: 96, bytes: [0xb0, 64, 127] },
      { tick: 192, bytes: [0xb0, 123, 0] }, { tick: 1920, bytes: [0xb0, 64, 0] },
    ]);
    const start = s.notes.find(([, ch, n]) => ch === 0 && n === 60)[0];
    expect(released.map((r) => r.t - start)).toEqual([expect.closeTo(2, 9)]);
    expect(s.synth.notetab).toEqual([]);
  });

  test("an All Sound Off sent ahead cuts the channel at its own time, and a later note plays", () => {
    // A note held into CC120 at 0.5 s, then a note from 1 s to 1.5 s on the same channel.
    const { s, pruned, cut, released } = play([
      H.midi.noteOn(0, 1, 64, 100), { tick: 480, bytes: [0xb1, 120, 0] },
      H.midi.noteOn(960, 1, 67, 100), H.midi.noteOff(1440, 1, 67),
    ]);
    expect(cut).toHaveLength(1);
    const start = cut[0].start;
    expect([cut[0].t - start, cut[0].at < cut[0].t]).toEqual([expect.closeTo(0.5, 9), true]);
    expect(released.map((r) => r.t - start)).toEqual([expect.closeTo(1.5, 9)]);
    expect(pruned.filter((p) => p.live)).toEqual([]);
    expect(s.synth.notetab).toEqual([]);
  });
});
