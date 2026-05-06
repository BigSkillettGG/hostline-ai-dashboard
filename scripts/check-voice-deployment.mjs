const baseUrl = process.argv[2]?.replace(/\/$/, "");

if (!baseUrl) {
  console.error("Usage: npm run check:voice -- https://voice.example.com");
  process.exit(1);
}

const health = await readJson(`${baseUrl}/health`);
const ready = await readJson(`${baseUrl}/ready`, { allowFailure: true });

console.log(`Voice service: ${health.service ?? "unknown"}`);
console.log(`Health: ${health.ok ? "ok" : "failed"}`);
console.log(`Production ready: ${ready.productionReady ? "yes" : "no"}`);

for (const check of ready.readinessChecks ?? health.readinessChecks ?? []) {
  const marker = check.ready ? "OK" : check.required ? "MISSING" : "OPTIONAL";
  console.log(`${marker.padEnd(8)} ${check.label}`);
}

if (!health.ok || !ready.productionReady) {
  process.exit(2);
}

async function readJson(url, options = {}) {
  const response = await fetch(url);
  if (!response.ok && !options.allowFailure) {
    throw new Error(`${url} returned ${response.status}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${url} did not return JSON: ${text.slice(0, 120)}`);
  }
}
