import { spawnSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outputDirName = process.env.PAGES_OUTPUT_DIR || "dist";
const dist = path.join(root, outputDirName);

const filesToCopy = [
  "_headers",
  "index.html",
  "styles.css",
  "main-enhanced.js",
  "manifest.webmanifest",
  "sw.js",
  "file-bundle.js",
];

const directoriesToCopy = ["icons", "vendor"];

/** Sync display version from sw.js CACHE into dist/index.html (single bump on CACHE). */
async function writeIndexHtmlToDist() {
  const swText = await readFile(path.join(root, "sw.js"), "utf8");
  const m = swText.match(/const CACHE = "harvest-orchard-v(\d+)"/);
  const vLabel = m ? `v${m[1]}` : "v?";
  let html = await readFile(path.join(root, "index.html"), "utf8");
  const next = html
    .replace(
      /<!-- harvest-app-version:v\d+ -->/,
      `<!-- harvest-app-version:${vLabel} -->`
    )
    .replace(
      /window\.__APP_VERSION__\s*=\s*"v\d+";/,
      `window.__APP_VERSION__ = "${vLabel}";`
    )
    .replace(
      /href="\.\/styles\.css\?v=v\d+"/,
      `href="./styles.css?v=${vLabel}"`
    );
  if (
    !/<!-- harvest-app-version:v\d+ -->/.test(html) ||
    !/window\.__APP_VERSION__\s*=\s*"v\d+";/.test(html) ||
    !/href="\.\/styles\.css\?v=v\d+"/.test(html)
  ) {
    console.warn(
      "prepare-pages: could not sync app version or styles.css?v= in index.html (markers missing?)"
    );
  }
  await writeFile(path.join(dist, "index.html"), next, "utf8");
}

function bundleMainEnhanced() {
  const args = [
    "--yes",
    "esbuild",
    "main-enhanced.js",
    "--bundle",
    "--format=iife",
    "--outfile=file-bundle.js",
    "--platform=browser",
    "--target=es2019",
    "--alias:three=./vendor/three/build/three.module.js",
  ];
  const r = spawnSync("npx", args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error("esbuild failed (npx esbuild …); file-bundle.js not built");
  }
}

async function main() {
  bundleMainEnhanced();
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  for (const file of filesToCopy) {
    if (file === "index.html") {
      await writeIndexHtmlToDist();
      continue;
    }
    await cp(path.join(root, file), path.join(dist, file), { recursive: false });
  }

  for (const directory of directoriesToCopy) {
    await cp(path.join(root, directory), path.join(dist, directory), { recursive: true });
  }

  const copied = await readdir(dist);
  console.log(`Cloudflare Pages package ready: ${dist}`);
  console.log(`Included: ${copied.join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
