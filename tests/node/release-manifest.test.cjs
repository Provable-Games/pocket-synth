"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { releaseManifest, writeBundle } = require("../../scripts/release-manifest");
const ROOT = path.resolve(__dirname, "../..");

async function fixture(t, stale = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pocket-release-test-"));
  const repo = path.join(dir, "repo");
  const home = path.join(dir, "gpg");
  fs.mkdirSync(repo);
  fs.mkdirSync(home, { mode: 0o700 });
  const env = { ...process.env, GNUPGHOME: home, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  t.after(() => {
    spawnSync("gpgconf", ["--homedir", home, "--kill", "gpg-agent"]);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  execFileSync("gpg", ["--batch", "--pinentry-mode", "loopback", "--passphrase", "", "--quick-generate-key", "Release fixture <fixture@example.invalid>", "ed25519", "sign", "0"], { env, stdio: "pipe" });
  const fingerprint = execFileSync("gpg", ["--with-colons", "--list-secret-keys"], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).split("\n").find((line) => line.startsWith("fpr:")).split(":")[9];
  fs.mkdirSync(path.join(repo, "scripts"));
  for (const file of ["scripts/build.js", "scripts/verify-dist.js", "scripts/size.js", "LICENSE", "NOTICE"]) fs.copyFileSync(path.join(ROOT, file), path.join(repo, file));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json")));
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "package-lock.json")));
  pkg.version = lock.version = lock.packages[""].version = "9.8.7";
  fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify(pkg));
  fs.writeFileSync(path.join(repo, "package-lock.json"), JSON.stringify(lock));
  fs.writeFileSync(path.join(repo, ".nvmrc"), process.version.slice(1) + "\n");
  fs.writeFileSync(path.join(repo, ".gitignore"), "node_modules/\n");
  fs.writeFileSync(path.join(repo, "webaudio-tinysynth.js"), "/*! Apache-2.0 fixture */\nfunction Fixture() { return 42; }\n");
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(repo, "node_modules"), "dir");
  execFileSync(process.execPath, [path.join(repo, "scripts/build.js")], { cwd: repo, env, stdio: "pipe" });
  if (stale) fs.appendFileSync(path.join(repo, "webaudio-tinysynth.min.js"), "/* stale */");
  const git = (...args) => execFileSync("git", ["-C", repo, ...args], { env, encoding: "utf8", stdio: "pipe" }).trim();
  git("init", "-q");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "user.signingkey", fingerprint);
  git("config", "commit.gpgsign", "false");
  git("add", ".");
  git("commit", "-qm", "Release fixture");
  git("tag", "-s", "v9.8.7", "-m", "Fixture release");
  return { repo, env, git, fingerprint, dir };
}

test("signed clean release produces reproducible identities and a checksum-bound upload bundle", async (t) => {
  const f = await fixture(t);
  const manifest = releaseManifest({ repo: f.repo, tag: "v9.8.7", env: f.env });
  assert.equal(manifest.commit, f.git("rev-parse", "HEAD"));
  assert.equal(manifest.signature.fingerprint, f.fingerprint);
  assert.equal(manifest.version, "9.8.7");
  const output = path.join(f.dir, "upload");
  writeBundle(f.repo, output, manifest);
  assert.deepEqual(fs.readdirSync(output).sort(), ["LICENSE", "NOTICE", "SHA256SUMS", "release-manifest.json", "webaudio-tinysynth.min.js", "webaudio-tinysynth.min.js.map"].sort());
  execFileSync("sha256sum", ["-c", "SHA256SUMS"], { cwd: output, stdio: "pipe" });
  assert.throws(() => writeBundle(f.repo, output, manifest), /EEXIST/);
  fs.appendFileSync(path.join(f.repo, "NOTICE"), "changed");
  assert.throws(() => releaseManifest({ repo: f.repo, tag: "v9.8.7", env: f.env }), /tracked changes/);
  assert.throws(() => writeBundle(f.repo, path.join(f.dir, "changed"), manifest), /asset changed after verification/);
});

test("unsigned, lightweight, wrong-version and non-tag checkouts cannot pass release verification", async (t) => {
  const f = await fixture(t);
  f.git("tag", "-a", "v9.8.6", "-m", "Unsigned");
  assert.throws(() => releaseManifest({ repo: f.repo, tag: "v9.8.6", env: f.env }), /signature verification failed/);
  f.git("tag", "v9.8.5");
  assert.throws(() => releaseManifest({ repo: f.repo, tag: "v9.8.5", env: f.env }), /annotated and signed/);
  f.git("tag", "-s", "v9.8.4", "-m", "Wrong version");
  assert.throws(() => releaseManifest({ repo: f.repo, tag: "v9.8.4", env: f.env }), /package version/);
  f.git("commit", "--allow-empty", "-qm", "New head");
  assert.throws(() => releaseManifest({ repo: f.repo, tag: "v9.8.7", env: f.env }), /check out the release tag/);
});

test("a signed tag with stale committed distribution files is rejected by the actual pinned build", async (t) => {
  const f = await fixture(t, true);
  assert.throws(() => releaseManifest({ repo: f.repo, tag: "v9.8.7", env: f.env }), /Command failed/);
});
