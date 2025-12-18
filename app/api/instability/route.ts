import { NextResponse } from "next/server";

export async function POST() {
  // Backend RNG: d6
  const roll = crypto.getRandomValues(new Uint32Array(1))[0] % 6 + 1;
  return NextResponse.json({ roll });
}
