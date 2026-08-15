import { NextResponse } from "next/server";
import { getStatus } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { job: string } }) {
  const status = getStatus(params.job);
  if (!status) {
    return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  }
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}
