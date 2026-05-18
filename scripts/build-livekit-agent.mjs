import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const outdir = resolve("dist-livekit-agent");

await rm(outdir, { force: true, recursive: true });
await mkdir(outdir, { recursive: true });

await build({
  banner: {
    js: 'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);',
  },
  bundle: true,
  entryPoints: ["services/livekit-agent/src/agent.ts"],
  external: [
    "@livekit/agents",
    "@livekit/agents-plugin-openai",
    "@livekit/noise-cancellation-node",
    "@livekit/rtc-node",
    "zod",
  ],
  format: "esm",
  legalComments: "none",
  logLevel: "info",
  minify: false,
  outfile: "dist-livekit-agent/agent.mjs",
  platform: "node",
  sourcemap: true,
  target: "node20",
});
