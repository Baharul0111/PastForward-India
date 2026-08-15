import { NextResponse } from "next/server";
import { getManifest, getPlan, paths, reelExists } from "@/lib/cache";
import { reconstructionRanges, type Lang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Everything the reel page needs once a reel exists: the video URL, the plan
 * (hook, takeaway, timeline, sources), the Wikimedia attributions, and the
 * reconstruction time-ranges for the "How do we know this?" card (skills.md §12).
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const lang = ((new URL(req.url).searchParams.get("lang") as Lang) || "en") as Lang;
  const slug = params.slug;

  const cached = reelExists(slug, lang);
  const plan = getPlan(slug, lang);
  const manifest = getManifest(slug);

  if (!cached && !plan) {
    return NextResponse.json({ error: "Not generated yet", slug, lang, cached: false }, { status: 404 });
  }

  // One credit per source file — shots 1 and 7 share the "today" photo, and the
  // credits card should read as a list of works, not a list of shots.
  const byPage = new Map<string, { shotIds: number[]; artist: string; license: string; sourcePage: string; title?: string }>();
  for (const s of manifest?.shots ?? []) {
    const a = s.attribution;
    if (!a?.sourcePage) continue;
    const hit = byPage.get(a.sourcePage);
    if (hit) hit.shotIds.push(s.shotId);
    else byPage.set(a.sourcePage, { shotIds: [s.shotId], ...a });
  }
  const attributions = Array.from(byPage.values()).sort((a, b) => a.shotIds[0] - b.shotIds[0]);

  return NextResponse.json(
    {
      slug,
      lang,
      cached,
      reelUrl: cached ? paths.reelUrl(slug, lang) : null,
      plan,
      trust: {
        sources: plan?.sources ?? [],
        attributions,
        reconstructionRanges: reconstructionRanges(),
        narrationIsAI: true,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
