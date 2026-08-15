/** Free Wikipedia research check. npm run research -- --name="Qutub Minar" */
import { research, locate } from "../lib/wikipedia";

const arg = (n: string, f?: string) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : f;
};

async function main() {
  const name = arg("name", "Qutub Minar")!;
  const r = await research(name);
  if (!r) {
    console.log(`✗ no article for "${name}"`);
    return;
  }
  const loc = await locate(r.title);
  console.log(`\n${r.title}`);
  console.log(`${r.url}`);
  console.log(`${r.wordCount} words${r.thin ? "  ⚠️ THIN" : ""} · ${loc.city}${loc.state ? ", " + loc.state : ""}\n`);
  console.log(r.text.slice(0, 700) + "…\n");
}
main().catch((e) => { console.error(e); process.exit(1); });
