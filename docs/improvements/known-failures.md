# Known failures retained for later diagnosis

The user authorized D-043: keep these tests and their original failed
results, but allow the documented exceptions to be nonblocking in ordinary
PR CI. These defects remain unresolved. Tests still execute with their
existing tolerances; diagnostic rerenders cannot replace the first attempt.
A dedicated diagnosis lab is deferred. [Issue #96](https://github.com/Provable-Games/webaudio-tinysynth/issues/96) is the
starting brief for the next investigator; [issue #97](https://github.com/Provable-Games/webaudio-tinysynth/issues/97) covers the later program120/drum58/drum49/drum53 and held-note program119 findings. They contain exact tests, run/artifact
locations, capture hashes, prior analysis and remaining unknowns.

Ordinary core CI explicitly uses `--accept-known-failures`. Local commands
default to strict behavior; accepting a known render failure requires `--out`
and valid retained Float32 sidecars and first-failure WAVs when applicable.
For GM and drum failures the gate also recomputes each original WAV pair
comparison and requires the reported difference and first-divergence index
to match. Drum repeat roles must be `repeat` and `kept source`; the kept
source must match the first source capture. Both original pairs are
required for the drum-54 exception.
The strict full-mix qualification mode rejects this option.

| Failure | Accepted ordinary-CI scope | Tracking |
| --- | --- | --- |
| Stereo generated-buffer descriptor contradiction | A final `convBuf` descriptor says one channel, while browser and Node capture traces, independent expected dimensions, retained raw bytes and SHA-256 agree on stereo. Only this descriptor discrepancy and its derived checks are excepted. All three engines, quality 0/1, 44.1/48 kHz. | #96 |
| WebKit noisy-program first PCM mismatch | `render q0 44100`: GM121/125; `render q0 48000`: GM127; `short-notes completed min`: q1/program120 or program126 (including both in the same case). Only the named parity/completed-attack assertion and its valid split-measurement layout are excepted. Other programs, fixtures, assertions and malformed evidence remain blocking. | #91 |
| WebKit drum-54 first PCM mismatch | `render q1 48000`, drum 54 only: both source/min parity and fresh-repeat/source checks, with valid 47-slot split measurements and original WAV pairs. Other drums, rates, qualities, checks and inconsistent capture roles/identity remain blocking. | [#96](https://github.com/Provable-Games/webaudio-tinysynth/issues/96) |
| WebKit drum-58 first PCM mismatch | `render q0 48000`, drum 58 source/min parity only, valid 47-slot split measurements and its original WAV pair. An approved GM127 failure in the same case is independently validated, including both groups and every WAV pair. Repeat assertions and other drums/settings remain blocking. | [#97](https://github.com/Provable-Games/webaudio-tinysynth/issues/97) |
| WebKit drum-49 first PCM mismatch | `render q1 44100`, drum 49 source/min parity only, valid 47-slot split measurements and its original WAV pair. Other drums, rates, qualities, repeat checks and corrupt/missing evidence remain blocking. | [#97](https://github.com/Provable-Games/webaudio-tinysynth/issues/97) |
| WebKit drum-53 first repeat mismatch | `render q0 48000`, drum 53 fresh-repeat/kept-source only, valid unified 47-slot measurements and its original WAV pair bound to the separately recorded first-source PCM SHA-256. Split measurements require an independently approved same-group parity failure. Passing source/min measurements remain in cross-engine checks. Parity failures for drum53, other drums/settings, and malformed evidence remain blocking. | [#97](https://github.com/Provable-Games/webaudio-tinysynth/issues/97) |
| WebKit held-note first PCM mismatch | `short-notes held source`, q1/program119 at 0.0700 s only: the pre-note-off/uncut comparison with tolerance `0.0002` of peak. Valid 768-item diagnostic summary and exact comparison reason/detail required. Audibility, finite output, page errors, cleanup and other programs/durations/builds remain blocking. This spec retains JSON, not first-attempt WAVs. | [#97](https://github.com/Provable-Games/webaudio-tinysynth/issues/97) |
| WebKit full-mix peak overshoot | Historical `ws-mid-default`, q1/48 kHz, first captures. Already outside ordinary PR CI in the manual strict qualification lane; its actual failed/incomplete verdict is retained. | #79, #91 |

## Retained evidence

- Final-review x64 browser run `38276286943`, unchanged engine at PR head
  `8d71f28`, retained WebKit `render q0 48000`, drum53 repeat/kept-source
  only: `max |diff| 2.717e-2 at sample 24352`, tolerance `0.000001`.
  Source/min parity passed and its 47-slot measurements remain unified.
  Both originals are finite mono Float32, 76,800 frames; independent
  remeasurement confirms max difference 0.027165832929313183 at frame
  24735 and first divergence 24352. No isolated 128-frame zero block was
  found. The diagnostic rerender matched; it does not clear attempt 1.
  Repeat WAV SHA-256:
  `a58a4f5c6906f5e9a5592e9a1a4c0f4783a19e3cf55fa136f55cc8030a508452`;
  kept-source WAV SHA-256:
  `25354706978c739207f65f2f8258d6bbe329e1d736870d6867cdc11bf424332f`.
  Issue #97 records exact job/artifact identifiers and remaining unknowns.
  Policy v8 added only this repeat scope under the user's standing
  investigate/document/defer instruction. Policy v9 additionally binds
  the kept source to a checksum recorded from the existing first-source
  PCM and requires unified measurements unless an approved same-group
  parity failure requires split rows. The original capture predates the
  new identity observation, so v9 rejects it for automatic acceptance;
  its failed comparison and evidence remain useful for investigation.
  Original checks, tolerances, raw artifact validation and passing parity
  measurements remain. This adds no renders or separate diagnostic tool.

- Final-review x64 browser run `38272212207`, unchanged engine at PR head
  `aa5ef42`, retained WebKit `render q1 44100`, drum49 source/min only:
  `max |diff| 1.346e-2 at sample 32648`, tolerance `0.000001`. Both original
  mono WAVs are finite, 70,560 frames. Independent remeasurement confirms
  max difference 0.013462384697049856 at frame 32786 and the reported first
  divergence. The diagnostic rerender matched; it does not clear attempt 1.
  Source WAV SHA-256:
  `8de3739b39407d3236000b7e8adc8fe5c907a8afccfd59c50603fef7c725b5c5`;
  min WAV SHA-256:
  `50eba6c9f0b6b91755086b6108c879e6c30bfccbf3328891ef9b5bc27cebe5f8`.
  Issue #97 records job/artifact IDs, exact scope and remaining unknowns.
  Policy v7 adds only this parity scope under the user's standing CI
  follow-up instruction; v5/v6 belonged to the reverted PR94 policy.
  The engine, assertions, tolerance and original artifacts are unchanged.


- x64 browser run `37680845661`, signed PR head `fa4bfc9`, retained
  `short-notes held source`, q1/program119 at 0.0700 s: `1.11e+0` of peak
  at the unchanged `0.0002` tolerance (about 5,550 times the threshold).
  Audibility, finite-output and page-error checks passed; the diagnostic
  rerender was clean. The JSON report SHA-256 is
  `61803d7edfea93db7358197852f5b6116931ebf19b4b59b8ccb58c8bc1f57706`.
  Its job/artifact identifiers and capture limits are in issue #97; the
  raw report is under `_evidence/p1-known-failures/new-scopes-20261007/ci-fa4bfc9/`.
  Code inspection and retained diagnostics do not isolate browser, harness
  or library causality. The user's subsequent investigate/fix/issue/defer
  instruction authorizes this exact unresolved comparison as nonblocking
  under policy v4; it does not waive silence, nonfinite output or execution
  failures. No tolerances or original reports change.

- x64 browser run `37667836399`, signed PR head `0a2cb88`, caught two
  additional WebKit first failures. `short-notes completed min`, q1/program120,
  differs by `9.68e-2` at the unchanged `0.000001` tolerance; its diagnostic
  rerender was clean. This spec retains JSON facts, not first-attempt WAVs.
  `render q0 48000`, drum58 source/min, differs by `1.542e-1`, first sample
  18720; its diagnostic was also clean. Both original drum WAVs are finite
  mono Float32, 48 kHz, 76,800 frames. Their hashes and recomputed canonical
  comparison match the retained report. The user subsequently authorized
  exactly these scopes as nonblocking ordinary-CI exceptions in policy v3;
  every assertion, tolerance and failed raw verdict remains preserved.
  [Issue #97](https://github.com/Provable-Games/webaudio-tinysynth/issues/97)
  records exact jobs/artifacts, hashes, capture limits and investigator steps.
  Evidence is under `_evidence/p1-pr95-step2/`; no new diagnosis was launched.


- The first D-043 policy browser run `37560041890`, head `7c19c5f`,
  passed the ordinary CI gate while retaining three q0/44.1 kHz descriptor
  failures (339/342 core cases passed normally). All first-capture records
  remain unchanged. Main CI `37560041984` passed.

- x64 browser run `37561194431`, signed head `1db92fa`, retained
  WebKit q1/48 kHz drum-54 first source/min and fresh-repeat/source
  mismatches: both `max |diff| 6.789e-3 at sample 20512` with tolerance
  `0.000001`. Both diagnostic rerenders were clean; both first checks and
  original WAV pairs stay failed/retained. Pair 1 roles are `source`/`min`;
  pair 2 roles are `repeat`/`kept source`, with the same kept source.
  Captures are mono Float32, 76,800 frames each. Source WAV SHA-256:
  `786812b4023ad6c5fb656e3051080791c5d20940cc4cf1631e4d9f3e53c0538a`;
  min/repeat SHA-256:
  `51478c33a9de6c51413cec5ac191576b5906b189463b163ab07be99bd063fd0a`.
  Raw results were 338/342 passing cases, 5,061/5,069 passing checks.
  The user subsequently authorized deferring only this exact additional
  scope. No drum-54 zero-gap, cause or audibility claim has been established.
- ARM browser run `37529210736`, PR head `9ab3af6`: 336/342 core cases
  passed. Five descriptor failures and a WebKit completed-short-note first
  mismatch were recorded; the clean diagnostic did not clear the first
  failure.
- x64 browser run `37553984962`, PR head `346968e`: 339/342 core cases
  passed. Firefox and WebKit q0/44.1 kHz min descriptors still contradicted
  valid stereo captures. All 72 saved generated-buffer artifacts were
  reopened; their captured dimensions and hashes agreed with retained bytes,
  the source/min counterpart and the other engines. ARM is not necessary
  for this reporting defect.
- The same x64 run retained the original WebKit q0/48 kHz GM127 mono WAV
  pair. First divergence is frame 14112. The source capture has 128 zero
  samples at `[14368,14496)` (2.67 ms), while min has audio there. Both remain
  active and different through final frame 76799. Actual maximum absolute
  difference is `0.48989351093769073` at frame 14562. Both are finite and
  within full scale. Source WAV SHA-256:
  `8c9e9a277d2b5e27da844809aaa0221d34634a4dc9772d4312a0a675fb6566cc`;
  min WAV SHA-256:
  `0480f5b62c5d72fc5e84238ede5e8549934d308bc1e713d568c14aa830c0ed83`.
- Earlier WebKit GM121 mono/44.1 kHz evidence in run `37524201138` also
  contains a 128-sample source-side zero interval, but its differing active
  tail ends before both captures become silent. Similar shapes do not prove
  a shared cause. The full-mix evidence recorded peaks near -1.70/-1.73;
  source/min and diagnostic captures retained that spike. No audibility or
  production-device conclusion follows from these fixture measurements.

The downloaded reports, original WAVs, Float32 sidecars and audit receipts
are preserved under `_evidence/p1-supervision/x64-comparison-20261006/` and
`_evidence/p1-noise-path/` outside the repository. The new original drum
records and captures are in `_evidence/p1-known-failures/ci-1db92fa/`. GitHub artifacts have
limited retention; these local copies are the evidence for the deferred lab.

## Limits and removal

Acceptance is a project-progress decision, not a passing audio measurement
or a demonstrated runtime cause. A new defect inside an excepted assertion
may also be nonblocking until diagnosis removes the exception. Unknown
checks, required missing/corrupted artifacts, stale provenance, nonfinite
samples and browser/cleanup/timeout failures still block ordinary CI.

Optional strict fixture measurements keep their actual verdicts; incomplete
inputs or references do not become certified. The owner retired mandatory
production/device certificates on 2026-10-12; focused sound checks and ongoing
composer listening are part of normal releases. Remove
an exception after the lab reproduces its cause, validates the fix against
retained first failures and fresh captures, and restores its blocking check.
The user controls merges and release acceptance.
