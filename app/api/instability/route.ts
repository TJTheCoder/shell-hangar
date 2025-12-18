import { NextResponse } from "next/server";

type Mode = "normal" | "adv" | "dis";

function d6(): number {
  return (crypto.getRandomValues(new Uint32Array(1))[0] % 6) + 1;
}

export async function POST(req: Request) {
  let mode: Mode = "normal";

  try {
    const body = (await req.json()) as { mode?: Mode };
    if (body?.mode === "adv" || body?.mode === "dis" || body?.mode === "normal") {
      mode = body.mode;
    }
  } catch {
    // if no json body, treat as normal
  }

  if (mode === "normal") {
    const r = d6();
    return NextResponse.json({ mode, rolls: [r], result: r });
  }

  const r1 = d6();
  const r2 = d6();
  const result = mode === "adv" ? Math.max(r1, r2) : Math.min(r1, r2);

  return NextResponse.json({ mode, rolls: [r1, r2], result });
}
