import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const outdir = resolve("dist-voice");

await rm(outdir, { force: true, recursive: true });
await mkdir(outdir, { recursive: true });

await build({
  banner: {
    js: 'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);',
  },
  bundle: true,
  entryPoints: ["services/voice/src/server.ts"],
  external: ["ws", "zod"],
  format: "esm",
  legalComments: "none",
  logLevel: "info",
  minify: false,
  outfile: "dist-voice/server.mjs",
  platform: "node",
  sourcemap: true,
  target: "node20",
});
