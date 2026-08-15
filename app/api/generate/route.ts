import { NextResponse } from "next/server";
import { startJob } from "@/lib/orchestrator";
import type { Lang } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; lang?: Lang; photo?: string };
    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "A monument name is required." }, { status: 400 });
    }

    const result = startJob({ name, lang: body.lang ?? "en", photo: body.photo });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
