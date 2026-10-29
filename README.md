# pocket-synth

A small, dependency-free JavaScript GM synthesizer and Standard MIDI File sequencer. Sounds are generated with Web Audio oscillators and buffers; no sample downloads are needed. Quality 0 uses lightweight chiptune sounds, and quality 1 uses FM sounds with multiple operators.

pocket-synth is Provable Games' modified fork of [webaudio-tinysynth](https://github.com/g200kg/webaudio-tinysynth) by Tatsuya Shinyagaito (g200kg). It removes the GUI and custom element for compact offline/onchain NFT `animation_url` embedding. It retains the JavaScript API, CommonJS/AMD exports and `window.WebAudioTinySynth`. Fork additions include validated MIDI parsing, fractional tempo, loop boundaries, context lifecycle controls, seeded noise/reverb, custom waves and operator filters. [NOTICE](NOTICE) records attribution and modifications; [LICENSE](LICENSE) is Apache-2.0. Report bugs or ask for help in [GitHub issues](https://github.com/Provable-Games/pocket-synth/issues).

## Quick start

Copy `webaudio-tinysynth.js` or the minified build into your page. Each works as a single classic script. Upstream CDN copies and the `webaudio-tinysynth` npm package include the upstream GUI; use this fork's files for the behavior documented here.

```html
<button id="play">Play a note</button>
<script src="webaudio-tinysynth.min.js"></script>
<script>
  const synth = new WebAudioTinySynth({quality: 1, voices: 64, lazy: true});
  document.getElementById("play").onclick = async () => {
    try {
      await synth.resume(); // start audio from a user gesture
      synth.prewarm();     // build metallic noise before live notes
      const t = synth.getAudioContext().currentTime;
      synth.noteOn(0, 60, 100, t);
      synth.noteOff(0, 60, t + 0.5);
    } catch (error) {
      console.error(error);
    }
  };
</script>
```

CommonJS: `const WebAudioTinySynth = require("./webaudio-tinysynth.js");`.

After starting audio, load and play MIDI bytes:

```js
synth.loadMIDI(midiArrayBuffer);
synth.setLoop(1);
synth.setLoopEnd(4 * 4 * 480); // four bars of 4/4 at 480 ticks/quarter
synth.playMIDI();
// Raw MIDI is also supported: synth.send([0x90, 60, 100]);
// Stop playback with synth.stopMIDI(); release resources with await synth.dispose().
```

## Demos and compatibility

Serve the repository root, for example with `python3 -m http.server 0`, and open [simple.html](simple.html), [soundedit.html](soundedit.html) (timbre editor/Web MIDI keyboard) or [jstest.html](jstest.html). The demos use local assets and start audio on a click, tap or key press. They display audio and URL-load errors. The editor applies changes with `setTimbre()` and reinstalls them after a quality change; its Patch output is a JavaScript array literal, not JSON.

Modern Chrome, Edge, Firefox and Safari support the library. Browsers require a user gesture for realtime audio; Web MIDI availability and permissions vary. No network access is needed for synthesis or playback from supplied MIDI bytes. `loadMIDIUrl()` explicitly fetches the URL you provide.

SMF formats 0 and 1 with ticks-per-quarter division are supported; format 2 and SMPTE division are rejected. On an `OfflineAudioContext`, schedule notes with explicit timestamps; the realtime sequencer is unavailable. Noise/reverb buffers are reproducible for the same seed, `bufferVersion` and sample rate, but rendered PCM can differ between engines. Short notes release each operator from the attack level reached at note-off; zero-length notes retain the release of operators with no attack.

## Properties

Settings are changed with the functions below (`setMasterVol()`, `setReverbLev()`, `setQuality()`, `setLoop()`, `setVoices()`, `setTsMode()`) or with constructor options. The instance also keeps them as plain properties:

|Property           |Default   |Description               |
|-------------------|----------|--------------------------|
|**masterVol**      | 0.5      | master volume            |
|**reverbLev**      | 0.3      | reverb level             |
|**useReverb**      | 1        | 0 disables reverb: no impulse buffer or convolver is created. Read when a context is installed; set it before `setAudioContext()` or lazy start. |
|**quality**        | 1        | 0: 1osc/note chiptune like<br/> 1: 2 or more oscs/note FM based|
|**loop**           | 0        | loop playMIDI            |
|**loopEnd**        | 0        | loop length in MIDI ticks; 0 = loop on the last event (see `setLoopEnd()`) |
|**tsmode**         | 0        | default timestamp mode   |
|**voices**         | 64       | Max number of simultaneous voices. Large number needs more CPU. On a realtime context, the limit holds when each voice the sequencer queues ahead (`playMIDI()`) starts: those voices are never stolen before they start, and voices over the limit at a later start are cut at that time. Notes you send with a future time count at once and can be stolen before they start, as upstream. |
|**seed**           | 0        | seed of the reverb and noise buffers (constructor option, read-only) |
|**bufferVersion**  | 1        | version of the buffer generation (read-only). A library change that alters the generated buffers increments it. |

* Assigning `masterVol`, `reverbLev` or `quality` directly does not apply the change; call `setMasterVol()`, `setReverbLev()` or `setQuality()`.
* The constructor creates an AudioContext unless `lazy: true` or `context` is supplied. Use `setAudioContext()` to switch contexts.
* On a coarse pointer (phones and tablets), a context the synth creates asks for `latencyHint: "playback"` (a default context where options are rejected); elsewhere it is a default context. A context you supply keeps its own.
* The realtime sequencer schedules `preroll` seconds ahead: 0.2 s, or 1 s on a coarse pointer. Stop, seek and song replacement still silence everything at once. A song stopped and played again resumes after the notes it had scheduled, so up to `preroll` of music is skipped (see `stopMIDI()`), and `getPlayStatus().play` turns 0 up to `preroll` before the last event sounds.
* The synth is ready as soon as the constructor returns (`isReady` is 1). `ready()` is kept for compatibility: it returns a `Promise` that resolves once the synth is initialized.
* `n1` (the metallic noise of cymbals and hi-hats) is generated once per context installation, when it is first needed: by `playMIDI()` (before it reads the clock), by `prewarm()`, or by the first note that plays it. Until then the install does not pay for it, and disposing or replacing the context first never generates it.
* The buffers are generated with mulberry32. The seed is first mixed with murmur3's `fmix32`, then each buffer gets its own stream, starting at `fmix32(seed) + k·2^30` (k = 0 reverb, 1 `n0`, 2 `n1`). So changing or skipping one buffer never changes another.

## Functions

These functions are available on a `WebAudioTinySynth` instance. Volume, quality, voice-limit, loop-end and channel-message functions validate before changing state and throw `TypeError` or `RangeError` on invalid arguments. `setLoop()` and `setTsMode()` assign their values without validation; use the modes documented below. Numeric strings are accepted. Channels are 0–15; notes, velocities, controllers and GM programs are 0–127; bends and bend ranges are 0–16383; times are finite and ≥ 0. Volumes and reverb levels must also fit a 32-bit float. `setVoices()` requires an integer ≥ 1 and `setLoopEnd()` integer ticks ≥ 0. Malformed raw MIDI byte messages are ignored; invalid `send()` argument types or timestamps can throw.

### Construction and lifecycle

#### WebAudioTinySynth(options)

> Constructor options:

>  **quality** : Specify timbre quality same as setQuality(). default is `1`.  
>  **useReverb** : If zero, disable reverb function.  
>  **voices** : max number of voices.  
>  **context** : an AudioContext or OfflineAudioContext to use instead of creating one. It stays yours: the synth never closes it.  
>  **destination** : with `context`, the AudioNode to play into. default is `context.destination`.  
>  **autoResume** : boolean, default `true`. With `false`, MIDI sends never resume a suspended or interrupted AudioContext, and the sequencer waits while its context is not running. Call public `resume()` from the user gesture to start or resume audio. `getAudioContext().suspend()` pauses the audio clock, envelopes and scheduled voices without reloading the song; resume does not rebuild them. This option applies to eager, lazy and supplied contexts.  
>  **lazy** : if `true`, no AudioContext is created until `resume()`, or until the first call that plays a note or sets MIDI state: `send()`, `noteOn()`, the channel `set...` functions, `reset()`, `loadMIDI()`, `locateMIDI()` or `playMIDI()`. Other calls do not create it, and `getAudioContext()` returns `null` until then. Call `resume()` from the click that starts audio, and call `loadMIDI()` and `reset()` in that click handler or after `resume()`: called earlier, they create the AudioContext outside the gesture (it then starts suspended until `resume()`).  
>  **seed** : an integer from `0` to `4294967295` that fixes the reverb impulse and the noise buffers (`n0`, `n1`). default is `0` (also for `null`). The same seed, `bufferVersion` and sample rate give the same buffer data on every load and in every instance; the data differs between sample rates (the buffers are 0.5 s long).  
>  On an OfflineAudioContext, schedule notes with explicit times; `playMIDI()` throws there. Every note scheduled before the render counts against `voices`, so call `setVoices()` with at least the number of notes, or the earliest ones are dropped.
>
>  For example, `new WebAudioTinySynth({quality:0, useReverb:0, voices:32})`  
>  An invalid `context` (see `setAudioContext()` for what it needs), `destination`, `lazy` or `autoResume` throws a `TypeError`, and an invalid `seed` a `TypeError` (not a number) or a `RangeError` (not an integer from 0 to 4294967295), before anything is created.

#### getAudioContext()

> Get current in-use AudioContext.

#### setAudioContext(audioContext, destinationNode)

> Replaces the current context with `audioContext`. It must have a `destination` and the factories the synth uses (`createGain`, `createDynamicsCompressor`, `createBuffer`, `createOscillator`, `createBufferSource`, `createBiquadFilter`, `createPeriodicWave`, and `createConvolver` when `useReverb` is on; `createStereoPanner` is optional); otherwise, or for a `destinationNode` without `connect()` or of another context, it throws a `TypeError` and the current context stays installed and open.
> Routes sounds to `destinationNode`, or to `audioContext.destination` if omitted.
> Get the installed context with `getAudioContext()`.
> The previous context's sounds stop, and the synth closes it if it created it. Call `stopMIDI()` before switching contexts during playback: the sequencer keeps the old context's clock, as upstream, so playback on a new context waits until that context's clock catches up.

#### prewarm()

> Generates the metallic noise `n1` now (once per context installation) instead of at the first `n1` note, so live notes start on time: `await synth.resume(); synth.prewarm();` before sending notes. It is synchronous, returns `undefined`, plays nothing and neither creates nor resumes a context: it does nothing before a lazy synth has one, after `dispose()`, or when `n1` is already built. `playMIDI()` calls it itself, before it reads the clock. It removes this deferred generation only, not other first-use or scheduling costs.

#### resume()

> Returns a `Promise` that resolves once the AudioContext is running. Browsers start audio only after a user gesture, so call it from a click, key or pointer handler. With `lazy`, it creates the AudioContext first. It rejects with the browser's error, or with an `Error` whose `code` is `AUDIO_CONTEXT_CLOSED` (the context is closed) or `SYNTH_DISPOSED`. On an OfflineAudioContext it resolves at once.
>
> `button.onclick = () => synth.resume().then(() => synth.playMIDI(), (e) => console.error(e));`

#### dispose()

> Releases the synth: stops every sound, disconnects its nodes, clears its timers, and closes the AudioContext if the synth created it (a context you passed in stays open). Returns a `Promise` that resolves when that is done; calling it again returns the same `Promise`. Afterwards the synth cannot be used again: functions that play or change MIDI state do nothing, `getAudioContext()` returns `null`, `ready()` resolves and `resume()` rejects.

### Synth settings

#### setQuality(q)

> Switch timbre set.  
> q=0 : chip tune like 1 osc / note.  
> q=1 : FM based 2 (or more) osc / note.  
> `q` is 0 or 1 (a numeric string is accepted). Reinstalls the built-in timbres, so custom timbres must be set again afterwards.

#### setMasterVol(lev)

> Master volume setting. default=0.5.

#### setReverbLev(lev)

> Reverb Level setting. default=0.3.

#### setVoices(v)

> set max voices that simultaneous sounds, default is 64.

#### setTsMode(mode)

> Set timestamp mode used by `send()` and channel-message functions. Use `0` or `1`; the value is assigned without validation.\
> If `mode=0` timestamp is a time of in-use audioContext's currentTime timeline.
> If `mode=1` timestamp is HighResolutionTime timeline.\
> With `mode=1`, a time that converts to before the context's current time (for example a `performance.now()` value taken before the context was created) is processed at once.

### Timbres and waves

#### getTimbreName(m,n)

> get name of specified timbre. m=0:normal channel voice,n=prog#. or m=1:drum track,n=note#  
> n is 0–127 for programs and 35–81 for drums; other values throw a `RangeError`. A program slot above 127 that a caller added itself and `setProgram()` accepts (see `setProgram`) is also named.

#### setSampleWave(name, samples)

> Registers a single-cycle sample table under `name` (`n` followed by a letter or `_`, then up to 30 letters, digits or `_`; `n0`, `n1` and other names with a digit second are reserved). `samples` is an array or typed array of one or more numbers in −1..1, copied. Each sample is held for `k = max(1, round(sampleRate/(440·N)))` frames, so the wave plays near its stored rate with sharp steps, and the table's home pitch is `sampleRate/(N·k)`: an operator's frequency (`note × t + f`) is the frequency of one whole cycle, for playback, the pitch envelope and FM. Steps are exact at the home pitch; at other pitches the browser resamples, so edges are interpolated (Chromium and Safari linearly, Firefox band-limited). Long tables (for example a 32,767-step LFSR) are accepted; at a literal `t` they play at very high rates, which Firefox renders slowly, so set `t`/`f` for the cycle rate you want. Registering a name again replaces it for later notes. A one-sample table plays as a constant (DC). Throws `TypeError` for an invalid name or a non-array, `RangeError` for other invalid data.

#### setHarmonicWave(name, real, imag)

> Registers a periodic wave under `name` (`w` followed by a letter or `_`, then up to 30 letters, digits or `_`; `w9999` and other names with a digit second are reserved), built with `createPeriodicWave(real, imag)`: element `i` is harmonic `i` (cosine in `real`, sine in `imag`), element 0 (DC) is ignored, and the peak is normalized to 1. `real` and `imag` are arrays or typed arrays of equal length, at least 2, of numbers that are finite as 32-bit floats; they are copied. Only the coefficients' ratios matter: very large or very small sets are rescaled before use.

#### setTimbre(m,n,p)

> Even webaudio-tinysynth has defaultly GM mapped timbre set, This function can overwrite with user-definable timbre.\
> `m=0` : timbre for normal channel.\
> `m=1` : timbre for rhythm channel (ch=9).\
> `n` : program number for normal channel or notenumber for rhythm channel.\
> `p` : timbre, a non-empty array of operator objects (see [Timbre Object Structure](#timbre-object-structure)); soundedit.html can create one.\
> `setTimbre` checks every operator before changing anything. `w` must be a built-in waveform (`sine`, `square`, `sawtooth`, `triangle`, `w9999`, `n0`, `n1`) or a registered name. `g` must be 0 (output), `n` (FM into operator `n−1`, `n` ≤ 10) or `10+n` (AM into operator `n−1`), where operator `n−1` comes earlier in the array. `a`, `h`, `d`, `r` and `q` must be ≥ 0 and finite as 32-bit floats (up to about 3.4e38); `t`, `f`, `v`, `s`, `p` and `k` finite; filter fields as described there. Numeric strings are read with `Number()`, and missing fields take their defaults. `p` is copied: unknown keys are kept and ignored, and later changes to your objects do not reach the synth. An invalid `p`, an `m` other than 0 or 1, or an `n` out of range (0–127 for `m=0`, 35–81 for `m=1`) throws a `TypeError` or `RangeError` and changes nothing. A note whose computed pitch, pitch-envelope target, level or sustain level is outside the 32-bit float range is not played. For compatibility, a name that code has written into the synth's internal `noiseBuf` or `wave` objects is still accepted and plays as before. This is unsupported: those objects are rebuilt whenever the AudioContext changes, and they do not exist before a lazy synth's first use. Register waves with `setSampleWave()` or `setHarmonicWave()` instead.

### MIDI sequencer

#### setLoop(f)

> Use `0` to play once or `1` to loop MIDI playback. The value is assigned without validation; playback tests its truthiness.

#### setLoopEnd(ticks)

> Where a looped song wraps, in MIDI ticks from the start of the song (the same unit as `getPlayStatus().maxTick`). Only matters while `setLoop()` is on.
> - `0` (default): the next pass starts on the song's last event, as upstream does. Any rest after that event is dropped.
> - Non-zero: each pass starts `max(ticks, tick of the last event)` ticks after the previous one. A value below the last event's tick never cuts the song short.
>
> For whole-bar looping, use `bars × quarter notes per bar × ppq`, where ppq is the file's ticks per quarter note. For example, 4 bars of 4/4 at ppq 480 is `setLoopEnd(7680)`. `setLoopEnd(synth.getPlayStatus().maxTick)` loops at the file's end-of-track marker.
>
> Timing: the rest after the last event is timed at the tempo in effect at the end of the song. The next pass then starts again at the song's starting tempo (120 BPM until its first tempo event), so a rest before the first event, and any music before the first tempo event, keep their length on every pass. The first pass keeps that rest too when it starts from tick 0 (after loadMIDI(), locateMIDI(0), or on a finished song).

#### loadMIDI(mididata)

> load MIDI data to built-in sequencer. mididata is a arraybuffer of SMF (.mid file contents). A successful load stops the current song as `stopMIDI()` does, so none of its scheduled notes, drum hits or channel volume, pan and modulation changes reach the new song.  
> Parsing uses bounded reads. Errors preserve the previous song, playback and channel state, and include `code`, byte `offset` and, inside a track, 0-based `track`:
>
> | Code | Reason |
> | --- | --- |
> | `SMF_INVALID_HEADER` | Invalid `MThd` header |
> | `SMF_UNSUPPORTED_FORMAT` | Format 2 or an unknown format |
> | `SMF_UNSUPPORTED_DIVISION` | SMPTE or zero time division |
> | `SMF_TRUNCATED` | Incomplete header, chunk or event, or fewer tracks than declared |
> | `SMF_MALFORMED` | Invalid event data |
>
> This is not a strict validator: tracks ending on an event boundary without End-of-Track, bytes after End-of-Track, and zero declared tracks still load. Use `try`/`catch` for untrusted files.

#### loadMIDIUrl(url, opts)

> Loads a Standard MIDI File from `url` and returns a promise that resolves with the response's `ArrayBuffer` once the song is installed. It rejects, leaving the current song, with an `Error` whose `code` is `HTTP_STATUS` (with `status`; statuses 200–299 succeed), `NETWORK_ERROR`, `LOAD_SUPERSEDED` (a newer `loadMIDIUrl()` or a direct `loadMIDI()` came first), `SYNTH_DISPOSED`, or an `SMF_*` code from `loadMIDI()`; with `opts.signal`'s reason when that `AbortSignal` aborts (an `AbortError` if the reason is missing or falsy); or with a `TypeError` for a missing `url` or an `opts.signal` that is not an `AbortSignal` (for example an `AbortController` passed instead of its `.signal`). It never throws (an `opts` whose `signal` cannot be read rejects with that error). Fire and forget is safe: `synth.loadMIDIUrl("song.mid")` leaves no unhandled rejection. To show errors: `synth.loadMIDIUrl(url).then(() => synth.playMIDI(), (e) => show(e.code || e.name))`.

#### playMIDI()

> play loaded MIDI data. On a finished song (every event sent, even while its last notes still ring), starts again from the beginning at the song's initial tempo and channel state. Does nothing for a song with no playable events. A looping song that cannot advance (all events on one tick with `loopEnd` unset) plays once and stops. Each timer callback processes at most 1000 events; the rest follow in order. Replay does not cut notes still sounding from the previous pass; those ringing tails share their channels with the new pass, so they take on its channel reset and the new pass's volume, pan and modulation changes. The first `playMIDI()` on each context installation first generates the metallic noise (see `prewarm()`) and only then reads the clock, so the song starts slightly later and nothing within it shifts.

#### stopMIDI()

> stop playing MIDI data. Every sounding or scheduled note and drum hit stops, and channel volume, pan and modulation changes scheduled for later are cancelled, so nothing changes after the stop. When `playMIDI()` resumes, it first gives every channel its latest volume, expression, pan and modulation: the values the song had set up to the resume position (including changes it had sent ahead of the stop) and your own, including a change you had scheduled for later with a time. Notes that were due in the `preroll` after the stop (0.2 s, 1 s on touch devices) are not replayed, as upstream.

#### locateMIDI(tick)

> locate current playing position in tick. Playback resumes at the first event at or after `tick`. Rebuilds tempo, programs, controllers, bend/range, RPN and SysEx tuning from the song up to `tick`, replacing manual and queued channel changes. Engine settings and timbres are kept. Does nothing without a loaded song.

#### getPlayStatus()

> get current MIDI sequence play status.
> return value is a object `{play:playstatus, maxTick:maxtick, curTick:currenttick, startTime:time}`. `startTime` is new in this fork. `play` turns 0, and `curTick` reaches `maxTick`, once the last event is scheduled: up to `preroll` before it sounds, while the song's end is still playing.
> `startTime` is the AudioContext time at which tick 0 of the current pass sounds, or `null` when not playing. With `loopEnd` set, an event at tick T of any pass sounds at `startTime` plus the time from tick 0 to T under the song's tempo map (120 BPM until its first tempo event). With `loopEnd` unset this holds only in the first pass: a later pass keeps the tempo the previous one ended on until its first tempo event (as upstream), so `startTime` is extrapolated at that tempo. Use `loopEnd` for exact sync. With `loopEnd` set and play from tick 0, tick 0 sounds 0.1 s after `playMIDI()`. Otherwise (`loopEnd` unset, after a seek or a resume) the next event plays 0.1 s after `playMIDI()`, and `startTime` is when tick 0 would have sounded, which can be in the past. Like `curTick`, it moves to the next pass when the sequencer reaches the end of the current one, up to `preroll` (0.2 s, 1 s on touch devices) before the last event sounds and before any rest up to `loopEnd`, so it can be later than `currentTime`: while it is, the previous pass is still sounding.
> To start visuals with the music: `const st = synth.getPlayStatus().startTime; setTimeout(start, (st - ctx.currentTime + (ctx.outputLatency || 0)) * 1000);`

### MIDI messages

#### reset()

> Reset all channel to initial state. Including all controllers, program, chVol, pan and bendRange.

#### send([midi-message], t)

> midi-message is an array of midi data-bytes for one message. For example,  
> `send([0x90, 60, 100], t)` is for NoteOn ch=1 note#=60 velocity=100.  
> `t` is a timestamp that this message should be processed.  
> The timeline of `t` is depends on timestampmode that is set by setTsMode() function.
> If timestampmode == 0 (default), `t` is a time (sec) in timeline of the in use audioContext.currentTime.  If timestampmode == 1, `t` is a time (msec) in HighResolutionTime (performance.now()) timeline.  
> In both timestamp mode, this message will be immediately processed if `t`=0 or omitted.
> If timestampmode is omitted, the mode depends on the `tsmode` property (default 0, see `setTsMode()`).  
> A message that is too short for its status byte (an array-like message with `length` 0 included), or has a data byte that is not 0–127, is ignored. Invalid argument types or timestamps can throw `TypeError` or `RangeError`. `t` must be omitted, 0 or a finite time ≥ 0.

### Channel message functions

Followings are voicing functions that controls each note directly. Each function is almost equivalent to corresponding `send([MIDI-message],t)` but prepared for human readability.  

In these functions, the `ch` parameter specify the MIDI channel. Each channel has individual timbre and set of control parameters, for example bend, modulation, expression, and so on. `ch` range is 0-15. (In MIDI spec., called 'channel 1-16')  
`ch`==9 is a special channel for rhythm. In this channel, each note number is assigned to individual percussive instruments according to GM drummap (Note number 35-81).

Almost function has the timestamp, `t` parameter. That specify accurate timing of the effect occur. Refer `send()` function for details of timestamp. Anyway the command is immediately processed if `t` is 0 or omitted.

#### noteOn(ch, note, velo, t)

> Generate a note in specified channel. `note` is the note number that specify pitch. `60` is middle 'C'. `velo` is velocity that control the volume of the note. velocity range is 0-127. this function is processed same as noteOff() if `velo` is `0`.

#### noteOff(ch, note, t)

> stop the note that is generated by noteOn(). One noteOff() (or equivalent noteOn with velo=0) should be called corresponding to one noteOn() call.

#### setModulation(ch, val, t)

> set modulation (vibrato) depth. `val` range is 0-127. +- 100 cent depth if val=127.

#### setChVol(ch, val, t)

> set volume of the channel. `val` range is 0-127. Default value is 100.

#### setPan(ch, val, t)

> Set pan of the channel. `val` range is 0-127. Default value=64.  
>  0:left  
> 64:center  
> 127:right.

#### setExpression(ch, val, t)

> Set expression level. `val` range is 0-127. Both Expression and ChVol are control the Channel volume, but Expression is mainly used as note's articulation.  

#### setSustain(ch, val, t)

> Set sustain pedal state. While sustain is on, generated notes in that channel are sustained even corresponding noteOff() is called. Note that `val` is judged as 'on' if `val>=64`. Usually use `0` and `127` as a value.

#### setProgram(ch, pg)

> Set timbre for that channel. `pg` range is 0-127 that is timbre number in GM map, or a slot you added to `synth.program` yourself (an unsupported compatibility path, as TinyChip uses); a program that does not exist throws a `RangeError` and changes nothing. A MIDI program change through `send()` is 0–127.

#### setBend(ch, val, t)

> Set pitch bend state. Notes in this channel are all affected to this pitch modification. `val` range is 0 to 16383 and the center with no bend is 8192. sensitivity is depends on `setBendRange()` setting. Default state is `8192`.

#### setBendRange(ch, val)

> Set bend sensitivity for that channel. `val` unit is 100/127 cent. That means +-1 octave if 0x600, +-1 semitone if 0x80.
 Default value is 0x100 that means +-200 cent (2 semitone) range.

#### allSoundOff(ch)

> Immediately stop current and scheduled voices on channel `ch`, zeroing their gain and bypassing release envelopes. Existing effect tails may continue.

#### resetAllControllers(ch)

> Control parameters of specified ch are reset. It includes Bend / Modulation / Expression / Sustain.

## MIDI implementation chart

|                        |Recognized|Description                     |
|------------------------|----------|--------------------------------|
|**Basic Channel**       | Yes      | 1-16. ch10 = drum track        |
|**NoteOn / NoteOff**    | Yes      | note# 0-127 / velocity 0-127   |
|**Polyphonic Pressure** | No       |                                |
|**Control Change**      | Yes      | see below                     |
|**Program Change**      | Yes      | program 0-127                  |
|**Channel Pressure**    | No       |                                |
|**Pitch Bend**          | Yes      | -8192 - +8191                  |
|------------------------|----------|--------------------------------|
|**Control Number**      |          |                                |
|**1**                   | Yes      | Modulation                     |
|**6 / 38**              | Yes      | Data Entry                     |
|**7**                   | Yes      | Channel Volume                 |
|**10**                  | Yes      | Pan                            |
|**11**                  | Yes      | Expression                     |
|**64**                  | Yes      | Sustain                        |
|**100/101**             | Yes      | RPN Index                      |
|------------------------|----------|--------------------------------|
|**Channel Mode Message**|          |                                |
|**120**                 | Yes      | all sound off. Sent with a future time, it cuts the voices that start by then at that time and keeps later ones; otherwise it stops them at once, as `allSoundOff()` |
|**121**                 | Yes      | reset all controller           |
|**123**                 | Yes      | all note off. Sent with a future time, as the sequencer does, it releases the voices that start by then at that time; otherwise it stops them at once, as `allSoundOff()` (also 124–127) |
|------------------------|----------|--------------------------------|
|**RPN**                 |          |                                |
|**0**                   | Yes      | Bend Range                     |
|**1**                   | Yes      | Channel Fine Tuning            |
|**2**                   | Yes      | Channel Coarse Tuning          |
|------------------------|----------|--------------------------------|
|**Universal SysEx**     |          |                                |
|**F0 F7 xx 04 03 lsb msb F7** | Yes | Master Fine Tuning            |
|**F0 F7 xx 04 04 00 msb F7** | Yes | Master Coarse Tuning           |
|------------------------|----------|--------------------------------|
|**GS Exclusive**        |          |                                |
|**F0 41 xx 42 12 40 00 05 xx xx xx xx sum F7** | Yes |Master Tuning |
|**F0 41 xx 42 12 40 00 05 xx sum F7** | Yes    |Master Transpose    |
|**F0 41 xx 42 12 40 1x 15 xx sum F7** | Yes    |Use For Rhythm Part |
|**F0 41 xx 42 12 40 1x 4x xx sum F7** | Yes    |Scale Tuning        |
|------------------------|----------|--------------------------------|

## Timbre Object Structure
As you can see that in source code, each timbre is represented as a object array. Fore example the program# 1 "Acoustic Grand Piano" is like this :

```
[{w:"sine",v:.4,d:0.7,r:0.1,},{w:"triangle",v:3,d:0.7,s:0.1,g:1,a:0.01,k:-1.2}]
```
Each element of the array means a oscillator and object member means :  
* g: output destination 0=final output / n=FM to specified osc
* w: waveform  
     "sine"/"sawtooth"/"square"/"triangle" (basic waveforms)  
     "w9999" (summing 1-4 harmonics)  
     "n0" (white noise)  
     "n1" (metalic noise)  
     "n…" (a wave registered with `setSampleWave`)  
     "w…" (a wave registered with `setHarmonicWave`)  
* v: volume  
* t: tune factor according to note#
* f: fixed frequency in Hz
* a: attack time
* h: hold time
* d: decay time
* s: sustain level
* r: release time  (5 params make AHDSR envelope)
* p: pitch bend
* q: pitch bend speed factor
* k: volume key tracking factor
* fl: optional fixed filter on this operator's output, `"lowpass"`, `"highpass"` or `"bandpass"`. Only on an operator with `g:0`. Without `fl` there is no filter.
* ff: cutoff (low- and high-pass) or centre (band-pass) frequency, a normal positive 32-bit float (at least 2^-126): Hz, or with `fk:1` a multiple of the note's frequency (including master, channel and scale tuning; not the operator's `t` or `f`, bend or pitch envelope). Required with `fl`. Clamped to 0.45 × the sample rate.
* fq: resonance as a linear Q, a normal positive 32-bit float (at least 2^-126), default 0.7071 (`Math.SQRT1_2`). Low- and high-pass are given `20·log10(fq)` dB, band-pass `fq`.
* fk: 1 to track the note frequency, 0 (default) for fixed Hz.

Like the other numeric fields, `ff`, `fq` and `fk` also accept a numeric string such as `"1000"`, read with `Number()`.

The filter is fixed for the life of the note, and is released with the voice. Example, a hi-hat through a 3 kHz high-pass: `[{w:"n1",t:0,f:440,v:0.3,d:0.04,fl:"highpass",ff:3000}]`.

Use the Timbre Editor in `soundedit.html` to audition parameters and generate a `setTimbre()` array.

## Development and testing

Use the Node version in [.nvmrc](.nvmrc) and `npm ci` to install locked development tools. The runtime library has no dependencies. Test runners use POSIX process groups and run on Linux/macOS.

| Command | Purpose |
| --- | --- |
| `npm run lint` | ESLint recommended rules |
| `npm run build -- .build` | Fresh minified file and map in an ignored directory |
| `npm test` | Unit, native Node and regression suites |
| `npm run test:unit` / `npm run test:node` / `npm run test:regression` | Individual suites |
| `npm run test:browser` | Offline Chromium smoke test of source and fresh minified builds |
| `npm run test:browser:matrix` | Chromium, Firefox and WebKit assertion matrix |
| `npm run test:browser:demos` | Demo interactions; select an engine with `-- --engines=chromium` |
| `npm run size` | Raw/gzip sizes and SHA-256 of source and fresh builds |
| `npm run bench -- node` / `npm run bench -- browser` | Initialization benchmarks; see `scripts/bench-init.js` for options |
| `npm run pack:check` | Verify package contents and install/require a freshly built tarball |
| `npm run verify` | Check committed distribution bytes against a fresh build and inline-safety rules |

Tests, `size` and `pack:check` build current source into ignored `.build/` and leave tracked distributions unchanged. To run a test file directly, refresh `.build/` with `node scripts/test-build.js`; `TINYSYNTH_MIN` selects another minified file. Regressions read upstream commit `3d75aee4b3f43cbd932265e7d60201fd5b770397` from full Git history, or from `TINYSYNTH_REFERENCE`. MIDI fixtures originate from [jazz-soft/test-midi-files](https://github.com/jazz-soft/test-midi-files).

For browser checks, install the pinned Playwright browsers (`npx playwright-core install --with-deps`; Chromium smoke needs only `--only-shell chromium`). CI runs lint, build checks, tests, browser smoke and the sharded browser matrix. The smoke test allows autoplay and does not verify the user-gesture requirement.

Ordinary browser CI accepts only the narrowly approved exceptions in [tests/browser/lib/known-failures.js](tests/browser/lib/known-failures.js), tracked in [#96](https://github.com/Provable-Games/pocket-synth/issues/96) and [#97](https://github.com/Provable-Games/pocket-synth/issues/97). Local defaults remain strict. Original failed assertions, tolerances and first-attempt artifacts remain preserved; clean diagnostic rerenders do not clear a failed first attempt. Unknown failures remain blocking. The manual `full-mix-qualification` workflow lane remains strict and does not use these exceptions; incomplete references or failed first captures prevent qualification. Native macOS runtime behavior remains unverified.

Agent work commands, repository constraints and AI-review configuration are in [AGENTS.md](AGENTS.md).

## Distribution verification and releases

Feature PRs never commit `webaudio-tinysynth.min.js` or its map. After each merge into `improve/integration`, [Dist CI](.github/workflows/dist.yml) builds, tests and commits both generated files. On `main`, distributions change only through a manual release PR; an integration-to-main PR can serve as the release PR when its version and generated files are current. Between releases they may lag source. The PR build check permits distribution changes only from `improve/integration` or `release/*`, and requires fresh build bytes.

To verify an embedded copy, check out a release tag or CI rebuild commit with full history and LF line endings, run `npm ci` and `npm run verify`, then compare your copy's SHA-256. Verification fails when committed distributions lag source, including the interval before integration's rebuild lands. The build keeps the license header, public names and ASCII-only inline-safe output (no `</script`, `<script` or `<!--`); the map is separate, with no `sourceMappingURL` comment.

Releases are manual:

1. Use the integration-to-main PR if it already contains the release version and fresh generated files. Otherwise, create `release/vX.Y.Z` from `main`, set the version with `npm version X.Y.Z --no-git-tag-version`, run `npm run build`, commit the generated files, and open a PR into `main`.
2. After the release PR passes checks and the maintainer merges it, verify the clean merge with `npm ci` and `npm run verify`. The maintainer signs and pushes the tag: `git tag -s vX.Y.Z <merge-sha>` and `git push origin vX.Y.Z`.
3. From the tag, the maintainer publishes with `gh release create vX.Y.Z webaudio-tinysynth.min.js webaudio-tinysynth.min.js.map`, including sizes and SHA-256 from `npm run size` in the notes. Focused listening is part of normal release checks.
