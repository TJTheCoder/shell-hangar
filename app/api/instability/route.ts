import { NextResponse } from "next/server";

type Mode = "normal" | "adv" | "dis";
type Pick = "highest" | "lowest";

function d6(): number {
  return (crypto.getRandomValues(new Uint32Array(1))[0] % 6) + 1;
}

function clampInt(n: unknown, min: number, max: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

export async function POST(req: Request) {
  // New API (preferred): { count, pick }
  // Old API (compat): { mode }
  let count = 1;
  let pick: Pick = "highest";
  let mode: Mode | null = null;

  try {
    const body = (await req.json()) as {
      mode?: Mode;
      count?: number;
      pick?: Pick;
    };

    // Prefer new shape if present
    if (body && (body.count !== undefined || body.pick !== undefined)) {
      count = clampInt(body.count, 1, 50); // safety rail
      pick = body.pick === "lowest" ? "lowest" : "highest";
    } else if (body?.mode === "adv" || body?.mode === "dis" || body?.mode === "normal") {
      mode = body.mode;
      if (mode === "normal") {
        count = 1;
        pick = "highest";
      } else if (mode === "adv") {
        count = 2;
        pick = "highest";
      } else {
        count = 2;
        pick = "lowest";
      }
    }
  } catch {
    // no json => default
  }

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(d6());

  const result =
    pick === "highest" ? Math.max(...rolls) : Math.min(...rolls);

  return NextResponse.json({
    // include mode if the caller used it (or if you want to log it client-side)
    mode: mode ?? undefined,
    count,
    pick,
    rolls,
    result,
  });
}
