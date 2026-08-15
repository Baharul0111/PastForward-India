/**
 * Loads .env.local for standalone scripts (tsx does not do it automatically).
 * Next.js loads it itself, so this is script-only. Import for side effects FIRST,
 * before anything that reads ALLOW_MEDIA / ALLOW_SORA / OPENAI_API_KEY.
 */
import fs from "node:fs";
import path from "node:path";

const p = path.join(process.cwd(), ".env.local");
if (fs.existsSync(p)) {
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
