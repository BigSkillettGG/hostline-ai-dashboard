#!/usr/bin/env node

/**
 * generate-vera-audio.mjs
 *
 * Pre-generates ElevenLabs TTS audio for ALL lines (Vera + callers) used
 * on the SignalHost marketing page.
 *
 * - Vera always uses one consistent voice (warm, professional female host)
 * - Each scenario has a DIFFERENT caller voice to feel like real people
 *
 * Usage:
 *   ELEVENLABS_API_KEY=sk-... node scripts/generate-vera-audio.mjs
 *
 * Or put ELEVENLABS_API_KEY in .env / .env.local and run:
 *   node scripts/generate-vera-audio.mjs
 *
 * Output: public/audio/vera-{scenario}-{index}.mp3
 *         public/audio/caller-{scenario}-{index}.mp3
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ─── Voice Config ───

// Vera — the AI host. Always the same voice.
const VERA_VOICE_ID = "UgBBYS2sOqTuMpoF3BR0";

// Caller voices — a different person for each scenario.
// Using ElevenLabs premade voices for variety.
const CALLER_VOICES = {
  faq:         "TxGEqnHWrfWFTfGW9XjX",  // Josh — deep young American male
  order:       "EXAVITQu4vr4xnSDxMaL",  // Bella — soft young American female
  reservation: "21m00Tcm4TlvDq8ikWAM",  // Rachel — calm young American female
  specials:    "ErXwobaYiN019PkySvjV",  // Antoni — well-rounded young American male
  allergy:     "XrExE9yKIg1WjnnlVkGX",  // Matilda — warm middle-aged American female
  complaint:   "VR6AewLTigWG4xSOukaG",  // Arnold — crisp middle-aged American male
  afterhours:  "g5CIjZEefAph4nQFvHAz",  // Ethan — young American male
};

const MODEL_ID = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";
const OUTPUT_DIR = resolve(process.cwd(), "public/audio");

// ─── Load .env if present ───
for (const f of [".env", ".env.local"]) {
  const p = resolve(process.cwd(), f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("ERROR: ELEVENLABS_API_KEY is required.");
  console.error("Set it as an environment variable or in .env / .env.local");
  process.exit(1);
}

// ─── Scenario Definitions ───

const SCENARIOS = [
  {
    id: "faq",
    lines: [
      { s: "vera",   t: "Thanks for calling Olive and Ember, this is Vera. How can I help tonight?" },
      { s: "caller", t: "Hey, what time do you guys close on Sundays?" },
      { s: "vera",   t: "We're open until 9 PM on Sundays. Kitchen takes last orders at 8:30." },
      { s: "caller", t: "And is there parking nearby?" },
      { s: "vera",   t: "There's metered street parking on Valencia, and a paid lot at 17th and Valencia, about a two minute walk." },
      { s: "caller", t: "Perfect, thanks!" },
      { s: "vera",   t: "You're welcome! Anything else I can help with tonight?" },
    ],
  },
  {
    id: "order",
    lines: [
      { s: "vera",   t: "Thanks for calling Olive and Ember, this is Vera. How can I help?" },
      { s: "caller", t: "I'd like to place a pickup order. Two margherita pizzas and a Caesar salad." },
      { s: "vera",   t: "Got it. Two margheritas and one Caesar. Any modifications? We can do gluten-free crust for four dollars more." },
      { s: "caller", t: "Gluten-free on one pizza, and no anchovy on the Caesar." },
      { s: "vera",   t: "Perfect. One regular margherita, one gluten-free, Caesar no anchovy. That's fifty four dollars. What name for pickup?" },
      { s: "caller", t: "Sarah." },
      { s: "vera",   t: "Sarah, your order will be ready in about 25 minutes. Pay at the counter. Sending you a text confirmation now." },
    ],
  },
  {
    id: "reservation",
    lines: [
      { s: "vera",   t: "Thanks for calling Olive and Ember, this is Vera. How can I help?" },
      { s: "caller", t: "I'd like to book a table for six this Saturday at 7:30." },
      { s: "vera",   t: "Saturday at 7:30 for six. I'll put in a reservation request for you. Any special occasion?" },
      { s: "caller", t: "It's my mom's 60th birthday. Could we get a quiet table near the window?" },
      { s: "vera",   t: "Happy birthday to her! I've noted the birthday and window preference. What name should I put it under?" },
      { s: "caller", t: "Priya Shah." },
      { s: "vera",   t: "Priya, I've sent the request to the team. You'll get a text once they confirm. Anything else?" },
    ],
  },
  {
    id: "specials",
    lines: [
      { s: "vera",   t: "Thanks for calling Olive and Ember, this is Vera. How can I help?" },
      { s: "caller", t: "What specials do you have tonight?" },
      { s: "vera",   t: "Tonight's special is a wood-fired branzino with lemon and capers for thirty four dollars. The chef's burrata is also back with heirloom tomatoes." },
      { s: "caller", t: "Ooh, nice. Do you have good red wines by the glass?" },
      { s: "vera",   t: "We have a Chianti Classico and a Montepulciano, both around sixteen dollars. Full wine list is on our website too." },
      { s: "caller", t: "Is there live music tonight?" },
      { s: "vera",   t: "Not tonight, but we have live jazz every Thursday from 7 to 10. Would you like to make a reservation for Thursday?" },
    ],
  },
  {
    id: "allergy",
    lines: [
      { s: "vera",   t: "Thanks for calling Olive and Ember, this is Vera. How can I help?" },
      { s: "caller", t: "My daughter has a severe nut allergy. Can you accommodate that?" },
      { s: "vera",   t: "I want to be upfront. We do use nuts in several dishes, and cross-contact is possible in our kitchen. For severe allergies, I'd recommend speaking with the chef directly." },
      { s: "caller", t: "Okay. Do you have gluten-free options?" },
      { s: "vera",   t: "We do. Gluten-free pizza crust is available for four dollars more, and several pasta dishes can be made with gluten-free pasta. I can note the allergy for your order." },
      { s: "caller", t: "That's helpful. What about vegan options?" },
      { s: "vera",   t: "Our roasted vegetable antipasto and the marinara pizza are both vegan. I can also ask the kitchen about modifications on other dishes." },
    ],
  },
  {
    id: "complaint",
    lines: [
      { s: "vera",   t: "Thanks for calling Olive and Ember, this is Vera. How can I help?" },
      { s: "caller", t: "I was there last night and my order was completely wrong. I got chicken instead of salmon." },
      { s: "vera",   t: "I'm really sorry to hear that. That's not the experience we want for you. Let me get the manager involved right away." },
      { s: "caller", t: "This is the second time it's happened. I want a refund." },
      { s: "vera",   t: "I understand your frustration. I've texted the manager with the details. They'll call you back within the hour to make this right." },
      { s: "caller", t: "Fine. My number is 415-555-0177." },
      { s: "vera",   t: "Got it. The manager will reach out shortly. I'm sorry again. We want to fix this." },
    ],
  },
  {
    id: "afterhours",
    lines: [
      { s: "vera",   t: "Thanks for calling Olive and Ember. We're closed right now, but this is Vera. I can still help." },
      { s: "caller", t: "Oh, when do you open tomorrow?" },
      { s: "vera",   t: "We open at 5 PM tomorrow, Tuesday. Kitchen takes orders until 9:30." },
      { s: "caller", t: "Can I make a reservation for tomorrow at 7?" },
      { s: "vera",   t: "I can put in a request for tomorrow at 7. How many guests?" },
      { s: "caller", t: "Four, under the name Rodriguez." },
      { s: "vera",   t: "Done. Party of four, tomorrow at 7, under Rodriguez. The team will confirm by text in the morning. Anything else?" },
    ],
  },
];

// ─── TTS Generation ───

async function generateAudio(text, voiceId, outputPath) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        speed: 1,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs failed (${response.status}): ${body}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(outputPath, buffer);
  return buffer.length;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  let totalFiles = 0;
  let totalBytes = 0;
  let skipped = 0;

  console.log("SignalHost — Marketing Audio Generator");
  console.log("========================================");
  console.log(`Vera voice:  ${VERA_VOICE_ID}`);
  console.log(`Model:       ${MODEL_ID}`);
  console.log(`Output:      ${OUTPUT_DIR}/`);
  console.log();

  for (const scenario of SCENARIOS) {
    const callerVoice = CALLER_VOICES[scenario.id];
    console.log(`▸ ${scenario.id} (caller voice: ${callerVoice})`);

    let veraIdx = 0;
    let callerIdx = 0;

    for (const line of scenario.lines) {
      const isVera = line.s === "vera";
      const idx = isVera ? veraIdx++ : callerIdx++;
      const prefix = isVera ? "vera" : "caller";
      const voiceId = isVera ? VERA_VOICE_ID : callerVoice;
      const filename = `${prefix}-${scenario.id}-${idx}.mp3`;
      const outputPath = resolve(OUTPUT_DIR, filename);

      if (existsSync(outputPath)) {
        console.log(`  SKIP  ${filename}`);
        skipped++;
        continue;
      }

      console.log(`  GEN   ${filename}`);
      console.log(`        [${isVera ? "Vera" : "Caller"}] "${line.t.slice(0, 60)}${line.t.length > 60 ? "..." : ""}"`);

      try {
        const bytes = await generateAudio(line.t, voiceId, outputPath);
        totalFiles++;
        totalBytes += bytes;
        console.log(`        ✓ ${(bytes / 1024).toFixed(1)} KB`);
      } catch (err) {
        console.error(`        ✗ ${err.message}`);
        console.error();
        console.error("If you see a 401, check your ELEVENLABS_API_KEY.");
        console.error("If you see a 429, you hit rate limits. Wait a minute and re-run.");
        console.error("(The script skips already-generated files, so re-running is safe.)");
        process.exit(1);
      }

      await new Promise((r) => setTimeout(r, 350));
    }
    console.log();
  }

  console.log("========================================");
  console.log(`Generated: ${totalFiles} files (${(totalBytes / 1024).toFixed(0)} KB)`);
  console.log(`Skipped:   ${skipped} files (already exist)`);
  console.log(`Total:     ${totalFiles + skipped} audio files across ${SCENARIOS.length} scenarios`);
  console.log();
  console.log("The marketing page loads these from /audio/ automatically.");
}

main();
