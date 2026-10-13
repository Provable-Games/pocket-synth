"use strict";

/* Freshness guard for tests/browser/specs/full-mix-reference.json. The
 * reference binds the raw bytes of the full-mix method files (METHOD_FILES in
 * tests/browser/specs/full-mix.js) and the pinned Playwright browser bundles.
 * A change to either leaves the strict full-mix-qualification lane unable to
 * pass; this check makes the pull request that causes it fail instead. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fullMix = require("../browser/specs/full-mix");

// Required cases the committed capture left incomplete, each with its measured reason in the file.
const DOCUMENTED_INCOMPLETE = [];

test("the committed full-mix reference matches the current method files and pinned browser bundles", () => {
  const reference = JSON.parse(fs.readFileSync(path.join(__dirname, "../browser/specs/full-mix-reference.json"), "utf8"));
  const expected = fullMix.referenceExpectedCases().length;
  assert.deepEqual(fullMix.referenceCoverageProblems(reference),
    DOCUMENTED_INCOMPLETE.length
      ? ["measured full-mix reference is incomplete (" + (expected - DOCUMENTED_INCOMPLETE.length) + "/" + expected +
        " engine/fixture/rate cases)"]
      : [],
    "tests/browser/specs/full-mix-reference.json is stale for the current full-mix method files or Playwright " +
    "browsers; recapture it in CI as README.md \"Recapturing the full-mix reference\" describes");
  assert.deepEqual(reference.coverage.incompleteCases.map((row) => row.id), DOCUMENTED_INCOMPLETE,
    "the reference's incomplete cases differ from the documented set");
});
