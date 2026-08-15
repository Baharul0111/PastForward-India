import { NextResponse } from "next/server";
import { slugify } from "@/lib/cache";
import { identify as identifyCall } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface IdentifyResult {
  name: string;
  city: string;
  state: string;
  slug: string;
  confidence: number;
  alternatives: { name: string; city: string; slug: string }[];
  notes?: string;
}

const hasKey = () => {
  const k = process.env.OPENAI_API_KEY;
  return Boolean(k && !k.includes("REPLACE_ME"));
};

/**
 * Photo → monument (vision, structured output, ~$0.005), or name passthrough.
 * confidence < 0.85 → the UI offers the alternatives (architecture.md §4).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; photo?: string };
    const name = (body.name ?? "").trim();

    if (!name && !body.photo) {
      return NextResponse.json({ error: "A monument name or a photo is required." }, { status: 400 });
    }

    // Typed name with no photo: nothing to identify, pass straight through.
    if (name && !body.photo) {
      const result: IdentifyResult = {
        name,
        city: "",
        state: "",
        slug: slugify(name),
        confidence: 1,
        alternatives: [],
      };
      return NextResponse.json(result);
    }

    if (!hasKey()) {
      return NextResponse.json(
        { error: "Photo identification needs an OpenAI key. Type the place name instead." },
        { status: 503 }
      );
    }

    const id = await identifyCall({ name: name || undefined, photoDataUrl: body.photo });

    const result: IdentifyResult = {
      name: id.name,
      city: id.city,
      state: id.state,
      slug: slugify(id.name),
      confidence: id.confidence,
      alternatives: (id.alternatives ?? []).slice(0, 3).map((a) => ({
        name: a.name,
        city: a.city,
        slug: slugify(a.name),
      })),
      notes: id.notes,
    };
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
