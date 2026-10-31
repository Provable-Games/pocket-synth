#!/usr/bin/env node
/* Offline release preflight. Run from the clean, signed tag after npm ci.
 * Writes a fresh upload directory only when --output is supplied. Never tags,
 * pushes, publishes, fetches or modifies the committed distribution files.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ASSETS = ["webaudio-tinysynth.min.js", "webaudio-tinysynth.min.js.map", "LICENSE", "NOTICE"];
const INPUTS = ["webaudio-tinysynth.js", "scripts/build.js", "package.json", "package-lock.json", ".nvmrc"];
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function releaseManifest({ repo = ROOT, tag, env = process.env }) {
  repo = path.resolve(repo);
  if (typeof tag !== "string" || !/^v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
    throw new Error("pass a release tag such as v2.1.2");
  }
  const git = (...args) => execFileSync("git", ["-C", repo, ...args], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const ref = "refs/tags/" + tag;
  if (git("cat-file", "-t", ref) !== "tag") throw new Error("release tag must be annotated and signed");
  const commit = git("rev-parse", ref + "^{commit}");
  if (git("rev-parse", "HEAD") !== commit) throw new Error("check out the release tag before verifying it");
  if (git("status", "--porcelain", "--untracked-files=no")) throw new Error("release checkout has tracked changes");
  const verified = spawnSync("git", ["-C", repo, "verify-tag", "--raw", ref], { env, encoding: "utf8" });
  const signature = /\[GNUPG:\] VALIDSIG ([0-9A-F]{40,64}) /.exec(verified.stderr || "");
  if (verified.status !== 0 || !signature) throw new Error("release tag GPG signature verification failed");
  const pkg = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8"));
  if (pkg.name !== "pocket-synth" || tag !== "v" + pkg.version) throw new Error("tag must match the pocket-synth package version");
  const lock = JSON.parse(fs.readFileSync(path.join(repo, "package-lock.json"), "utf8"));
  if (lock.version !== pkg.version || lock.packages[""].version !== pkg.version) throw new Error("package-lock version differs from the release");
  const node = fs.readFileSync(path.join(repo, ".nvmrc"), "utf8").trim().replace(/^v/, "");
  if (process.version !== "v" + node) throw new Error("use the release's .nvmrc Node version: " + node);
  // Bind the bundle to the clean snapshot that is about to be verified, rather
  // than accepting new bytes written by another process during verification.
  const files = {};
  for (const file of [...ASSETS, ...INPUTS]) {
    const bytes = fs.readFileSync(path.join(repo, file));
    files[file] = { bytes: bytes.length, sha256: sha256(bytes) };
  }
  // The tagged recipe checks the installed compiler and compares both outputs
  // byte for byte, including inline safety. Its output is diagnostic, not JSON.
  execFileSync(process.execPath, [path.join(repo, "scripts/verify-dist.js")], {
    cwd: repo, env, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 24,
  });
  for (const [file, expected] of Object.entries(files)) {
    const bytes = fs.readFileSync(path.join(repo, file));
    if (bytes.length !== expected.bytes || sha256(bytes) !== expected.sha256) throw new Error("release file changed during verification: " + file);
  }
  if (git("status", "--porcelain", "--untracked-files=no")) throw new Error("release checkout has tracked changes after verification");
  return {
    schema: "pocket-synth-release/v1", version: pkg.version, tag,
    commit, tagObject: git("rev-parse", ref),
    signature: { format: "openpgp", fingerprint: signature[1] },
    build: { node, terser: pkg.devDependencies.terser, command: "npm ci && npm run verify" },
    files,
  };
}

function writeBundle(repo, output, manifest) {
  // Refuse replacement: a previous upload directory may already be reviewed.
  fs.mkdirSync(output);
  for (const file of ASSETS) {
    const bytes = fs.readFileSync(path.join(repo, file));
    if (sha256(bytes) !== manifest.files[file].sha256 || bytes.length !== manifest.files[file].bytes) throw new Error("release asset changed after verification: " + file);
    fs.writeFileSync(path.join(output, file), bytes);
  }
  fs.writeFileSync(path.join(output, "release-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const checksums = [...ASSETS, "release-manifest.json"].sort().map((file) =>
    sha256(fs.readFileSync(path.join(output, file))) + "  " + file + "\n").join("");
  fs.writeFileSync(path.join(output, "SHA256SUMS"), checksums);
}

function main(argv) {
  const tag = argv.shift();
  let repo = ROOT;
  let output;
  while (argv.length) {
    const flag = argv.shift();
    if (!["--repo", "--output"].includes(flag) || !argv.length || argv[0].startsWith("--")) throw new Error("usage: release-manifest.js TAG [--repo CHECKOUT] [--output NEW_DIRECTORY]");
    if (flag === "--repo") repo = path.resolve(argv.shift());
    else output = path.resolve(argv.shift());
  }
  const manifest = releaseManifest({ repo, tag });
  if (output) writeBundle(repo, output, manifest);
  process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
}

module.exports = { releaseManifest, writeBundle };
if (require.main === module) {
  try { main(process.argv.slice(2)); } catch (error) {
    process.stderr.write("release verification failed: " + error.message + "\n");
    process.exitCode = 1;
  }
}
