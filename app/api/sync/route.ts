import { NextResponse } from "next/server";

import { runFullSync } from "@/services/runFullSync";

export async function GET() {
  const result = await runFullSync();
  return NextResponse.json(result);
}

export async function POST() {
  const result = await runFullSync();
  return NextResponse.json(result);
}
