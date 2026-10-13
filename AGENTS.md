# Working on TinySynth

## Repository map and constraints

- `webaudio-tinysynth.js`: the synthesizer, timbres, MIDI parser and sequencer in one classic script, exported through CommonJS, AMD or `window.WebAudioTinySynth`.
- `simple.html`, `soundedit.html`, `jstest.html`: local demos; `bower_components/webaudio-controls/` contains their vendored controls, not a synth runtime dependency.
- `scripts/`: build, distribution/package checks, benchmarks and bounded test runners. `tests/unit/`, `tests/node/`, regression scripts and `tests/browser/` cover the engine and demos; `test-midi/` holds fixtures.
- `.github/workflows/`: CI and distribution generation. `.github/scripts/`: standard-library Python AI-review helpers and their regression tests. `.github/review-agents.json`: provider configuration and review scope; `review.py` owns the automated policy and TinySynth role.

Keep synthesis dependency-free, compact and usable as an offline script inlined in an NFT `animation_url` page. Preserve classic-script/CommonJS/AMD/global exports, public names, ES2015 runtime syntax, copyright headers and both Apache licenses. Do not add runtime network access or dependencies. Explicit `loadMIDIUrl()` fetching is part of the existing API. Follow surrounding style; avoid broad abstractions and speculative defenses.

Verify review findings against intended behavior and actual consequences. Prefer small fixes; assess likelihood, exposure and maintenance cost before treating an issue as blocking. Flag new hot-path network calls, trusted services or protocol restrictions with their concrete tradeoff before implementing them.

## Commands and generated files

Use `.nvmrc` and `npm ci`. Work in your assigned checkout; stop only your own processes. Keep temporary local evidence outside the repo and delete it once the work merges. GitHub issues, PRs and comments must stand on their own: put findings, versions and CI run links in the text, never local paths.

```sh
npm run lint
npm run build -- .build
npm test
npm run test:browser
npm run pack:check
```

Run checks proportionate to the changed behavior. Use `npm run test:unit`, `npm run test:node` or `npm run test:regression` for individual suites; see README for [browser commands](README.md#development-and-testing) and [release verification](README.md#distribution-verification-and-releases). Regressions require full Git history or `TINYSYNTH_REFERENCE`. Browser tools use the locked Playwright version; respect shared read-only browser installs and host coordination when present. Browser servers default to ephemeral ports.

Tests build fresh minified output under ignored `.build/`; `node scripts/test-build.js` refreshes it for direct test-file runs. `TINYSYNTH_MIN` selects another build. `node_modules/` and `tmp/` are also ignored. Test runners fail on empty/incomplete suites and enforce `package.json` file/test floors; raise floors to actual printed counts when adding tests.

Feature PRs never commit `webaudio-tinysynth.min.js` or its map, and nobody edits them by hand. Integration CI generates them after merges; `main` uses [manual release PRs](README.md#distribution-verification-and-releases). Check locally with `node scripts/check-dist.js --unchanged-from=origin/<base-branch>`; use a fresh ignored build for validation.

Ordinary browser CI has narrowly approved exceptions in `tests/browser/lib/known-failures.js`, tracked in [#96](https://github.com/Provable-Games/pocket-synth/issues/96) and [#97](https://github.com/Provable-Games/pocket-synth/issues/97). Local defaults and full-mix qualification stay strict. Preserve original assertions, tolerances and failed first attempts; clean diagnostics do not clear them. Do not relax tests or widen exceptions as routine cleanup.

## Documentation and vendored assets

Maintain three guides: README for human usage/API/testing/releases, NOTICE for upstream attribution and concise modifications, and AGENTS for agent commands/constraints/CI setup. CLAUDE only points here. Update the affected guide with code changes; do not create task journals, status ledgers or standalone narrative reports.

Full-mix method, tolerance and setup fingerprints hash raw file bytes, including comments and fixture metadata, so any edit to those files invalidates the committed full-mix reference until it is recaptured.

Treat `bower_components/webaudio-controls/webaudio-controls.js` as an unmodified upstream file. To update it, replace it from a specific upstream commit and record that commit and SHA-256 in NOTICE; preserve its license and copyright header. Do not include demo controls in the synth package.

## AI-review CI setup and maintenance

This section applies to agents working on AI-review infrastructure. Human administrators configure branch rulesets to require `Codex review gate` and `Claude review gate`, and supply the Actions variables and secrets below (repository values override organization values). Ruleset and secret configuration is an administrator task; review helpers do not change them. There are no model/effort defaults:

| Name | Kind | Purpose |
| --- | --- | --- |
| `CODEX_REVIEW_MODEL` | Variable | Full Codex model ID |
| `CODEX_REVIEW_EFFORT` | Variable | Codex reasoning effort |
| `CLAUDE_REVIEW_MODEL` | Variable | Full Claude model ID, not a resolving alias |
| `CLAUDE_REVIEW_EFFORT` | Variable | Effort accepted by the pinned Claude CLI; vocabulary in `review-agents.json` |
| `CODEX_AUTH_DOT_JSON` | Secret | Organization-managed Codex `auth.json` |
| `CLAUDE_CODE_OAUTH_TOKEN` | Secret | Claude Code OAuth credential |

Codex is pinned by `.github/scripts/codex-cli/package-lock.json`, not `CODEX_CLI_VERSION`. From the repository root, update it with `(cd .github/scripts/codex-cli && npm install --package-lock-only --ignore-scripts @openai/codex@<version>)` (replace `<version>` with the intended version) and verify CLI flags. Claude's base action is pinned in `claude-review.yml`; update its accepted effort vocabulary and verify flags/transcript handling together. Other actions use full SHA pins.

Review helpers, policy and configuration come from the trusted **BASE revision**, separately from the untrusted PR checkout. Keep `.github/prompts` sparse-checkout patterns while legacy bases still need Markdown prompts. The `.github` fingerprint must cover all staged helpers/configuration and be rechecked after each run. A base without configuration fails, except the explicitly reported one-time `main` bootstrap from HEAD. A broken base configuration never falls back to HEAD.

Only same-repository, non-draft PRs use credentials. Fork/Dependabot reviews fail explicitly and need maintainer handling; drafts skip intentionally. Title/body edits do not replace real review gates; base changes rerun review. Missing settings/credentials, malformed or incomplete results and CLI failures fail closed. Completed HIGH/CRITICAL findings block; MEDIUM/LOW are advisory. The authoritative policy and output contract are in [review.py](.github/scripts/review.py) and [review_lib.py](.github/scripts/review_lib.py); provider configuration is in [review-agents.json](.github/review-agents.json) and the [workflows](.github/workflows/).

Troubleshooting: setting errors name the variable; reported-model mismatches require a full model ID. Codex authentication failures require an organization admin to refresh `CODEX_AUTH_DOT_JSON`; refreshed run tokens are discarded, never written back to secrets. Claude failures report a sanitized category. Only a completed run with malformed output carrying no review content is retried once; runtime failures, findings and explicit incomplete reviews are not retried. The first failed result remains available, and partial output cannot approve a PR. Diagnose Actions logs without exposing credentials.

```sh
python3 -I -B -m unittest discover -s .github/scripts -p 'test_*.py' -v
shellcheck .github/scripts/*.sh
actionlint .github/workflows/*.yml
```

Helper tests need Python 3.9+, Git and Bash and use fake providers; a real Actions run verifies credentials, runners and models. Set `REVIEW_TEST_BUN` to the pinned action's Bun binary to exercise optional configuration-isolation coverage.
