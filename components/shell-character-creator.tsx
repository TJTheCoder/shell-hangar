"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDebouncedEffect } from "@/lib/use-debounced-effect";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Play,
  FastForward,
  Dices,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { SYSTEMS, type SystemSlot } from "@/lib/systems/systems";
import { SystemCatalogueModal } from "@/components/system-catalogue-modal";

import { CORE_SYSTEMS } from "@/lib/systems/core-systems";
import { FRAME_SPECS } from "@/lib/frame-specs/frame-specs";
import { CoreSystemModal } from "@/components/core-system-modal";
import { FrameSpecsModal } from "@/components/frame-specs-modal";
import { CombatSection } from "@/components/combat-section";

/* ---------------- Types ---------------- */

type Stats = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
};

type AbilityKey = keyof Stats;

type SystemCondition =
  | { state: "ok" }
  | { state: "disabled"; count: number }
  | { state: "destroyed" };

type InstalledSystem = {
  systemId: string;
  slot: SystemSlot;
  condition?: SystemCondition;
};

type StructureKey = SystemSlot | "core";
type StructureState = Record<StructureKey, SystemCondition>;

/* ---------------- Constants ---------------- */

const STAT_DEFS: Array<{ key: AbilityKey; label: string; short: string }> = [
  { key: "str", label: "Strength", short: "STR" },
  { key: "dex", label: "Dexterity", short: "DEX" },
  { key: "con", label: "Constitution", short: "CON" },
  { key: "int", label: "Intelligence", short: "INT" },
  { key: "wis", label: "Wisdom", short: "WIS" },
  { key: "cha", label: "Charisma", short: "CHA" },
];

const DEFAULT_STATS: Stats = {
  str: 8,
  dex: 8,
  con: 8,
  int: 8,
  wis: 8,
  cha: 8,
};

const MAX_GENERATION = 99;

const PROF_BONUS = 6;

// System caps (UPDATED)
// - Total cap unchanged (computed from Techno)
// - Hull has a SLOT COST cap of 4
const HULL_COST_CAP = 4;

const SLOT_LABELS: Record<SystemSlot, string> = {
  hull: "Hull",
  disk: "Disk",
  left_arm: "Left Arm",
  right_arm: "Right Arm",
  back: "Back",
  legs: "Legs",
};

// Display order (UPDATED)
const STRUCTURE_ORDER: Array<[label: string, key: StructureKey]> = [
  ["Core", "core"],
  ["Hull", "hull"],
  ["Disk", "disk"],
  ["Left Arm", "left_arm"],
  ["Right Arm", "right_arm"],
  ["Back", "back"],
  ["Legs", "legs"],
];

/* ---------------- Utils ---------------- */

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const fmtSigned = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const abilityMod = (score: number) => Math.floor((score - 10) / 2);

function isSystemSlot(x: unknown): x is SystemSlot {
  return (
    x === "hull" ||
    x === "disk" ||
    x === "left_arm" ||
    x === "right_arm" ||
    x === "legs" ||
    x === "back"
  );
}

function sortedTags(tags?: string[]) {
  return (tags ?? []).slice().sort((a, b) => a.localeCompare(b));
}

function parseComplexity(tags?: string[]) {
  for (const t of tags ?? []) {
    const m = /^Complexity:\s*(\d+)\s*$/i.exec(String(t).trim());
    if (m) return Math.max(0, Math.trunc(Number(m[1])));
  }
  return 0;
}

function normalizeCondition(input: any): SystemCondition {
  if (!input || typeof input !== "object") return { state: "ok" };
  if (input.state === "destroyed") return { state: "destroyed" };
  if (input.state === "disabled") {
    const c = Number(input.count);
    return {
      state: "disabled",
      count: Number.isFinite(c) ? Math.max(1, Math.trunc(c)) : 1,
    };
  }
  return { state: "ok" };
}

function conditionLabel(c: SystemCondition) {
  if (c.state === "destroyed") return "Destroyed";
  if (c.state === "disabled") return `Disabled: ${c.count}`;
  return null;
}

function decrementDisabled(cond: SystemCondition): SystemCondition {
  if (cond.state === "destroyed") return cond;
  if (cond.state === "disabled") {
    const next = cond.count - 1;
    if (next < 1) return { state: "ok" };
    return { state: "disabled", count: next };
  }
  return cond;
}

function hasAnyDisabled(installed: InstalledSystem[], structures: StructureState) {
  const sysHas = installed.some(
    (s) => normalizeCondition(s.condition).state === "disabled",
  );
  const structHas = Object.values(structures).some(
    (c) => normalizeCondition(c).state === "disabled",
  );
  return sysHas || structHas;
}

function d6(): number {
  // Client-side RNG; avoids having to update /api/instability.
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return (u[0] % 6) + 1;
}

function applyInstabilityToCondition(
  cur: SystemCondition,
  result: number,
): SystemCondition {
  const c = normalizeCondition(cur);

  if (result === 1) return { state: "destroyed" };

  if (c.state === "destroyed") return c;

  if (c.state === "disabled") {
    // IMPORTANT: increment by 1 (no stacking/append)
    return { state: "disabled", count: c.count + 1 };
  }

  // fresh disable is 2 turns
  return { state: "disabled", count: 2 };
}

/**
 * Parses expressions like:
 * - "d20"
 * - "2d6+3"
 * - "12d6 + 18"
 * - "2d6+1d4+3" (supported)
 */
function parseDiceExpression(expr: string): {
  ok: boolean;
  normalized: string;
  terms?: Array<
    | { kind: "dice"; count: number; sides: number; sign: 1 | -1 }
    | { kind: "flat"; value: number; sign: 1 | -1 }
  >;
  error?: string;
} {
  const raw = (expr ?? "").trim();
  if (!raw) return { ok: false, normalized: "", error: "Enter a roll." };

  const s = raw.replace(/\s+/g, "").toLowerCase();

  const re = /([+-]?)(\d*d\d+|\d+)/g;
  let m: RegExpExecArray | null;

  const terms: Array<
    | { kind: "dice"; count: number; sides: number; sign: 1 | -1 }
    | { kind: "flat"; value: number; sign: 1 | -1 }
  > = [];

  let consumed = 0;

  while ((m = re.exec(s))) {
    const full = m[0];
    const signStr = m[1] ?? "";
    const termStr = m[2] ?? "";

    if (m.index !== consumed) {
      return { ok: false, normalized: s, error: "Invalid roll format." };
    }
    consumed += full.length;

    const sign: 1 | -1 = signStr === "-" ? -1 : 1;

    if (termStr.includes("d")) {
      const parts = termStr.split("d");
      const countStr = parts[0];
      const sidesStr = parts[1];

      const count = countStr === "" ? 1 : Number(countStr);
      const sides = Number(sidesStr);

      if (!Number.isFinite(count) || count <= 0 || count > 999) {
        return { ok: false, normalized: s, error: "Invalid dice count." };
      }
      if (!Number.isFinite(sides) || sides < 2 || sides > 100000) {
        return { ok: false, normalized: s, error: "Invalid die sides." };
      }

      terms.push({
        kind: "dice",
        count: Math.trunc(count),
        sides: Math.trunc(sides),
        sign,
      });
    } else {
      const v = Number(termStr);
      if (!Number.isFinite(v)) {
        return { ok: false, normalized: s, error: "Invalid modifier." };
      }
      terms.push({ kind: "flat", value: Math.trunc(Math.abs(v)), sign });
    }
  }

  if (consumed !== s.length) {
    return { ok: false, normalized: s, error: "Invalid roll format." };
  }

  const normalized = terms
    .map((t, i) => {
      const sign = t.sign === -1 ? "-" : i === 0 ? "" : "+";
      if (t.kind === "flat") return `${sign}${t.value}`;
      return `${sign}${t.count}d${t.sides}`;
    })
    .join("");

  return { ok: true, normalized, terms };
}

function rollDiceExpression(expr: string): {
  ok: boolean;
  normalized?: string;
  total?: number;
  breakdown?: string;
  error?: string;
} {
  const parsed = parseDiceExpression(expr);
  if (!parsed.ok || !parsed.terms)
    return { ok: false, error: parsed.error ?? "Invalid roll." };

  const totalDice = parsed.terms
    .filter((t) => t.kind === "dice")
    .reduce((sum, t) => sum + (t.kind === "dice" ? t.count : 0), 0);

  if (totalDice > 5000) {
    return { ok: false, error: "Too many dice." };
  }

  let total = 0;
  const lines: string[] = [];

  for (const t of parsed.terms) {
    if (t.kind === "flat") {
      total += t.sign * t.value;
      lines.push(`${t.sign === -1 ? "−" : "+"}${t.value}`);
      continue;
    }

    const rolls: number[] = [];
    for (let i = 0; i < t.count; i++) {
      const r = Math.floor(Math.random() * t.sides) + 1;
      rolls.push(r);
    }
    const subtotal = rolls.reduce((a, b) => a + b, 0);
    total += t.sign * subtotal;

    const rollList =
      rolls.length <= 30
        ? `[${rolls.join(", ")}]`
        : `[${rolls.slice(0, 30).join(", ")}, …]`;

    lines.push(
      `${t.sign === -1 ? "−" : "+"}${t.count}d${t.sides} ${rollList} = ${subtotal}`,
    );
  }

  const breakdown = lines.join("\n").replace(/^\+/, "");

  return { ok: true, normalized: parsed.normalized, total, breakdown };
}

/* ---------------- Main ---------------- */

export function ShellCharacterCreator({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);

  const [shellName, setShellName] = useState("");
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [saveProfs, setSaveProfs] = useState<AbilityKey[]>([]);

  const [coreSystemId, setCoreSystemId] = useState<string | null>(null);
  const [coreModalOpen, setCoreModalOpen] = useState(false);

  const [frameSpecIds, setFrameSpecIds] = useState<string[]>([]);
  const [frameSpecsOpen, setFrameSpecsOpen] = useState(false);

  const [installedSystems, setInstalledSystems] = useState<InstalledSystem[]>(
    [],
  );

  // Structures (UPDATED: adds Disk)
  const [structureState, setStructureState] = useState<StructureState>({
    hull: { state: "ok" },
    disk: { state: "ok" },
    left_arm: { state: "ok" },
    right_arm: { state: "ok" },
    legs: { state: "ok" },
    back: { state: "ok" },
    core: { state: "ok" },
  });

  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [catalogueDefaultSlot, setCatalogueDefaultSlot] =
    useState<SystemSlot>("hull");

  const [instabilityBuffer, setInstabilityBuffer] = useState<number[]>([]);

  const [instabilityPopup, setInstabilityPopup] = useState<{
    open: boolean;
    title: string;
    body: string;
  }>({ open: false, title: "", body: "" });

  const [bufferCriticalPopup, setBufferCriticalPopup] = useState<{
    open: boolean;
    y: number;
  }>({ open: false, y: 0 });

  const [pendingInstability, setPendingInstability] =
    useState<StructureKey | null>(null);

  // Spares: track USED internally (persisted as available for DB compatibility)
  const [sparesUsed, setSparesUsed] = useState<number | null>(null);

  // Dice roller: complex expressions
  const [rollExpr, setRollExpr] = useState("d20");
  const [lastRoll, setLastRoll] = useState<{
    expr: string;
    normalized: string;
    total: number;
    breakdown: string;
  } | null>(null);
  const [rollError, setRollError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  /* ---------------- Attribute edits (with generation cap) ---------------- */

  const setStat = (key: AbilityKey, value: number) => {
    setStats((prev) => {
      const nextValue = clamp(value, 8, 30);

      const investedTotal =
        Math.max(0, prev.str - 8) +
        Math.max(0, prev.dex - 8) +
        Math.max(0, prev.con - 8) +
        Math.max(0, prev.int - 8) +
        Math.max(0, prev.wis - 8) +
        Math.max(0, prev.cha - 8);

      const currentInvested = Math.max(0, prev[key] - 8);
      const nextInvested = Math.max(0, nextValue - 8);

      const nextTotal = investedTotal - currentInvested + nextInvested;

      if (nextTotal > MAX_GENERATION) return prev;

      return { ...prev, [key]: nextValue };
    });
  };

  const toggleSaveProf = (key: AbilityKey) => {
    setSaveProfs((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 2) return prev;
      return [...prev, key];
    });
  };

  const toggleFrameSpec = (id: string) => {
    setFrameSpecIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  /* ---------------- Derived values ---------------- */

  const invested = {
    str: Math.max(0, stats.str - 8),
    dex: Math.max(0, stats.dex - 8),
    con: Math.max(0, stats.con - 8),
    int: Math.max(0, stats.int - 8),
    wis: Math.max(0, stats.wis - 8),
    cha: Math.max(0, stats.cha - 8),
  };

  const generation =
    invested.str +
    invested.dex +
    invested.con +
    invested.int +
    invested.wis +
    invested.cha;

  const fort = Math.floor((invested.str + invested.con + invested.cha) / 3);
  const agility = Math.floor((2 * invested.dex + invested.wis) / 3);
  const techno = Math.floor((invested.int + invested.wis + invested.cha) / 3);
  const internal = Math.floor((invested.str + invested.con + invested.int) / 3);

  const damageThresholdBonus = fort * 2;
  const sparesBonus = Math.floor(fort / 2);

  const armorClassBonus = agility;
  const moveSpeedBonusFt = Math.floor(agility / 2) * 10;

  const saveDCBonus = techno;
  const systemCapacityBonus = Math.floor(techno / 2);

  const bufferSizeBonus = internal;
  const bufferDurationBonus = Math.floor(internal / 2);
  const bufferDuration = Math.max(1, 1 + bufferDurationBonus);

  const baseDamageThreshold = 16;
  const baseSpares = 5;
  const baseAttackBonus = 6;
  const baseMoveSpeedFt = 40;
  const baseArmorClass = 8;
  const baseSaveDC = 10;
  const sensorsRangeFt = 100;

  const damageThreshold = baseDamageThreshold + damageThresholdBonus;
  const sparesMax = baseSpares + sparesBonus;
  const attackBonus = baseAttackBonus;
  const movementSpeedFt = baseMoveSpeedFt + moveSpeedBonusFt;
  const armorClass = baseArmorClass + armorClassBonus;
  const saveDC = baseSaveDC + saveDCBonus;
  const forwardSaveBonus = saveDC - 10;

  // Spares (USED internally => Available derived)
  const sparesUsedValue = useMemo(() => {
    const u = sparesUsed ?? 0;
    return clamp(u, 0, sparesMax);
  }, [sparesUsed, sparesMax]);

  const sparesAvailable = Math.max(0, sparesMax - sparesUsedValue);
  const sparesPct = sparesMax <= 0 ? 0 : (sparesAvailable / sparesMax) * 100;

  useEffect(() => {
    setSparesUsed((prev) => {
      const u = prev ?? 0;
      return clamp(u, 0, sparesMax);
    });
  }, [sparesMax]);

  const useOneSpare = () =>
    setSparesUsed((prev) => clamp((prev ?? 0) + 1, 0, sparesMax));
  const restoreOneSpare = () =>
    setSparesUsed((prev) => clamp((prev ?? 0) - 1, 0, sparesMax));

  const saveBonus = (key: AbilityKey) =>
    abilityMod(stats[key]) + (saveProfs.includes(key) ? PROF_BONUS : 0);

  const skillBonus = (key: AbilityKey) => abilityMod(stats[key]) + PROF_BONUS;

  // Total cap unchanged
  const TOTAL_CAP = 19 + systemCapacityBonus;

  /* ---------------- Buffer behavior ---------------- */

  useEffect(() => {
    setInstabilityBuffer((prev) => prev.slice(0, Math.max(0, bufferSizeBonus)));
  }, [bufferSizeBonus]);

  const filledCount = instabilityBuffer.length;
  const canFill = bufferSizeBonus >= 1 && filledCount < bufferSizeBonus;
  const canUnfill = bufferSizeBonus >= 1 && filledCount > 0;

  const onFillOne = () => {
    if (!canFill) return;
    setInstabilityBuffer((prev) => [...prev, bufferDuration]);
  };

  const onUnfillOne = () => {
    if (!canUnfill) return;
    setInstabilityBuffer((prev) => prev.slice(1));
  };

  /* ---------------- Systems cost helpers ---------------- */

  const systemCostById = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of SYSTEMS) map.set(s.id, s.cost);
    return map;
  }, []);

  const getSystemCost = (id: string) => systemCostById.get(id) ?? 0;

  const getSlotCost = (slot: SystemSlot) =>
    installedSystems
      .filter((x) => x.slot === slot)
      .reduce((sum, x) => sum + getSystemCost(x.systemId), 0);

  const getTotalCost = () =>
    installedSystems.reduce((sum, x) => sum + getSystemCost(x.systemId), 0);

  const installedSystemIdSet = useMemo(
    () => new Set(installedSystems.map((x) => x.systemId)),
    [installedSystems],
  );

  // UPDATED: no system-count limit; hull has cost cap 4; total cap unchanged
  const installSystem = (systemId: string, slot: SystemSlot) => {
    if (installedSystemIdSet.has(systemId)) return;

    const cost = getSystemCost(systemId);
    const wouldTotal = getTotalCost() + cost;
    if (wouldTotal > TOTAL_CAP) return;

    if (slot === "hull") {
      const wouldHull = getSlotCost("hull") + cost;
      if (wouldHull > HULL_COST_CAP) return;
    }

    setInstalledSystems((prev) => [
      ...prev,
      { systemId, slot, condition: { state: "ok" } },
    ]);
  };

  const removeSystem = (systemId: string) => {
    setInstalledSystems((prev) => prev.filter((x) => x.systemId !== systemId));
  };

  const repairSystem = (systemId: string) => {
    setInstalledSystems((prev) =>
      prev.map((x) =>
        x.systemId === systemId ? { ...x, condition: { state: "ok" } } : x,
      ),
    );
  };

  const repairStructure = (slot: StructureKey) => {
    setStructureState((prev) => ({ ...prev, [slot]: { state: "ok" } }));
  };

  const coreSystemName = useMemo(() => {
    if (!coreSystemId) return null;
    return CORE_SYSTEMS.find((c) => c.id === coreSystemId)?.name ?? coreSystemId;
  }, [coreSystemId]);

  const selectedFrameSpecs = useMemo(() => {
    const defs = new Map(FRAME_SPECS.map((s) => [s.id, s]));
    return frameSpecIds
      .map((id) => defs.get(id))
      .filter(Boolean)
      .map((s) => s!);
  }, [frameSpecIds]);

  const combatFrameSpecSystems = useMemo(() => {
    const defs = new Map(FRAME_SPECS.map((s) => [s.id, s]));
    return frameSpecIds
      .map((id) => defs.get(id))
      .filter(Boolean)
      .map((spec) => ({
        id: `frame-spec:${spec!.id}`,
        name: spec!.name,
        description: spec!.description ?? "",
        tags: sortedTags((spec as any).tags ?? []),
      }));
  }, [frameSpecIds]);

  const combatInstalledSystems = useMemo(() => {
    return installedSystems
      .map((inst) => {
        const def = SYSTEMS.find((s) => s.id === inst.systemId);
        if (!def) return null;

        const cond = normalizeCondition(inst.condition);
        return {
          id: def.id,
          name: def.name,
          description: def.description ?? "",
          tags: sortedTags(def.tags),
          condition: cond.state === "ok" ? undefined : { state: cond.state },
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      name: string;
      description: string;
      tags: string[];
      condition?: { state?: "disabled" | "destroyed" };
    }>;
  }, [installedSystems]);

  /* ---------------- Instability rolling (UPDATED) ---------------- */

  // Hull advantage (UPDATED):
  // "Hull has advantages equal to intact non-Core systems."
  // We interpret this as: count of non-core structures in state "ok" (includes Hull itself).
  // If Hull is disabled, it has 0 advantages.
  const hullAdvantages = useMemo(() => {
    const hull = normalizeCondition(structureState.hull);
    if (hull.state === "disabled") return 0;

    const nonCore: SystemSlot[] = [
      "hull",
      "disk",
      "left_arm",
      "right_arm",
      "back",
      "legs",
    ];

    let intact = 0;
    for (const k of nonCore) {
      const c = normalizeCondition(structureState[k]);
      if (c.state === "ok") intact += 1;
    }
    return intact;
  }, [structureState]);

  const rollInstability = async (slot: StructureKey) => {
    setError(null);

    // Determine roll set + selection rule
    let rolls: number[] = [];

    if (slot === "core") {
      // Disadvantage: 2d6 take lowest
      const r1 = d6();
      const r2 = d6();
      rolls = [r1, r2];
    } else if (slot === "hull") {
      // Advantage: (advantages + 1) d6 take highest; if disabled, no advantage => 1 roll
      const count = Math.max(1, hullAdvantages);
      rolls = Array.from({ length: count }, () => d6());
    } else {
      // Normal: 1d6
      rolls = [d6()];
    }

    const result =
      slot === "core"
        ? Math.min(...rolls)
        : slot === "hull"
          ? Math.max(...rolls)
          : rolls[0];

    const rollHeader =
      slot === "core"
        ? `Disadvantage: [${rolls.join(", ")}] → ${result}`
        : slot === "hull" && rolls.length > 1
          ? `Advantage x${hullAdvantages - 1}: [${rolls.join(", ")}] → ${result}`
          : `Roll: ${result}`;

    // No effect on 4+
    if (result >= 4) {
      setInstabilityPopup({
        open: true,
        title: `Instability (${slot === "core" ? "Core" : SLOT_LABELS[slot]})`,
        body: `${rollHeader}\nNo effect.`,
      });
      return;
    }

    // Core special behavior retained
    if (slot === "core") {
      const cur = normalizeCondition(structureState.core);
      const nextCore = applyInstabilityToCondition(cur, result);

      setStructureState((prev) => ({ ...prev, core: nextCore }));

      const outcome =
        nextCore.state === "destroyed"
          ? "Destroyed"
          : nextCore.state === "disabled"
            ? `Disabled: ${nextCore.count}`
            : "OK";

      setInstabilityPopup({
        open: true,
        title: `Instability (Core)`,
        body: `${rollHeader}\nCore structure is now ${outcome}.`,
      });
      return;
    }

    // UPDATED: Instabilities always apply to the STRUCTURE (not a random system),
    // and then ALL systems in that structure copy the same effect.
    const curStruct = normalizeCondition(structureState[slot]);
    const nextStruct = applyInstabilityToCondition(curStruct, result);

    setStructureState((prev) => ({ ...prev, [slot]: nextStruct }));

    setInstalledSystems((prev) =>
      prev.map((s) => {
        if (s.slot !== slot) return s;

        const cur = normalizeCondition(s.condition);
        const next = applyInstabilityToCondition(cur, result);
        return { ...s, condition: next };
      }),
    );

    const outcome =
      nextStruct.state === "destroyed"
        ? "Destroyed"
        : nextStruct.state === "disabled"
          ? `Disabled: ${nextStruct.count}`
          : "OK";

    setInstabilityPopup({
      open: true,
      title: `Instability (${SLOT_LABELS[slot]})`,
      body: `${rollHeader}\n${SLOT_LABELS[slot]} structure is now ${outcome}. All systems in ${SLOT_LABELS[slot]} copy this effect.`,
    });
  };

  /* ---------------- Load ---------------- */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSavedAt(null);

      const { data, error } = await supabase
        .from("characters")
        .select(
          "shell_name,str,dex,con,int,wis,cha,save_prof_1,save_prof_2,installed_systems,core_system_id,frame_specs,instability_buffer,structure_state,spares_current",
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data) {
        setShellName(data.shell_name ?? "");
        setStats({
          str: data.str ?? 8,
          dex: data.dex ?? 8,
          con: data.con ?? 8,
          int: data.int ?? 8,
          wis: data.wis ?? 8,
          cha: data.cha ?? 8,
        });

        const loadedProfs: AbilityKey[] = [];
        const p1 = (data.save_prof_1 as AbilityKey | null) ?? null;
        const p2 = (data.save_prof_2 as AbilityKey | null) ?? null;
        if (p1 && STAT_DEFS.some((s) => s.key === p1)) loadedProfs.push(p1);
        if (p2 && STAT_DEFS.some((s) => s.key === p2) && p2 !== p1)
          loadedProfs.push(p2);
        setSaveProfs(loadedProfs.slice(0, 2));

        setCoreSystemId((data as any).core_system_id ?? null);

        const rawFrameSpecs = (data as any).frame_specs;
        if (Array.isArray(rawFrameSpecs)) {
          setFrameSpecIds(rawFrameSpecs.map(String).slice(0, 4));
        } else {
          setFrameSpecIds([]);
        }

        const rawInstalled = (data as any).installed_systems;
        if (Array.isArray(rawInstalled)) {
          const cleaned: InstalledSystem[] = rawInstalled
            .map((x: any) => ({
              systemId: String(x?.systemId ?? ""),
              slot: x?.slot,
              condition: normalizeCondition(x?.condition),
            }))
            .filter(
              (x: any) => typeof x.systemId === "string" && isSystemSlot(x.slot),
            )
            .map((x: any) => ({
              systemId: x.systemId,
              slot: x.slot,
              condition: x.condition,
            }));
          setInstalledSystems(cleaned);
        } else {
          setInstalledSystems([]);
        }

        const rawBuffer = (data as any).instability_buffer;
        if (Array.isArray(rawBuffer)) {
          const cleaned = rawBuffer
            .map((n: any) => Number(n))
            .filter((n: any) => Number.isFinite(n))
            .map((n: number) => Math.trunc(n));
          setInstabilityBuffer(cleaned);
        } else {
          setInstabilityBuffer([]);
        }

        const rawStructureState = (data as any).structure_state;
        if (rawStructureState && typeof rawStructureState === "object") {
          setStructureState({
            hull: normalizeCondition(rawStructureState.hull),
            disk: normalizeCondition(rawStructureState.disk),
            left_arm: normalizeCondition(rawStructureState.left_arm),
            right_arm: normalizeCondition(rawStructureState.right_arm),
            legs: normalizeCondition(rawStructureState.legs),
            back: normalizeCondition(rawStructureState.back),
            core: normalizeCondition(rawStructureState.core),
          });
        } else {
          setStructureState({
            hull: { state: "ok" },
            disk: { state: "ok" },
            left_arm: { state: "ok" },
            right_arm: { state: "ok" },
            legs: { state: "ok" },
            back: { state: "ok" },
            core: { state: "ok" },
          });
        }

        // DB stores AVAILABLE spares; internal tracks USED
        const sc = (data as any).spares_current;
        if (Number.isFinite(Number(sc))) {
          const available = clamp(Math.trunc(Number(sc)), 0, sparesMax);
          const used = sparesMax - available;
          setSparesUsed(clamp(used, 0, sparesMax));
        } else {
          setSparesUsed(null);
        }
      } else {
        setShellName("");
        setStats(DEFAULT_STATS);
        setSaveProfs([]);
        setCoreSystemId(null);
        setFrameSpecIds([]);
        setInstalledSystems([]);
        setInstabilityBuffer([]);
        setStructureState({
          hull: { state: "ok" },
          disk: { state: "ok" },
          left_arm: { state: "ok" },
          right_arm: { state: "ok" },
          legs: { state: "ok" },
          back: { state: "ok" },
          core: { state: "ok" },
        });
        setSparesUsed(null);
      }

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId, sparesMax]);

  /* ---------------- Save ---------------- */

  const saveWithOverrides = async (
    overrides?: Partial<{
      installed_systems: InstalledSystem[];
      structure_state: StructureState;
      instability_buffer: number[];
      spares_used: number;
    }>,
  ) => {
    setSaving(true);
    setError(null);
    setSavedAt(null);

    const normalizedBuffer =
      bufferSizeBonus >= 1
        ? (overrides?.instability_buffer ?? instabilityBuffer).slice(
            0,
            bufferSizeBonus,
          )
        : [];

    const usedForSave = clamp(
      overrides?.spares_used ?? (sparesUsed ?? 0),
      0,
      sparesMax,
    );
    const availableForSave = Math.max(0, sparesMax - usedForSave);

    const payload = {
      user_id: userId,
      shell_name: shellName.trim(),
      ...stats,
      save_prof_1: saveProfs[0] ?? null,
      save_prof_2: saveProfs[1] ?? null,

      core_system_id: coreSystemId,
      frame_specs: frameSpecIds.slice(0, 4),

      installed_systems: overrides?.installed_systems ?? installedSystems,
      structure_state: overrides?.structure_state ?? structureState,
      instability_buffer: normalizedBuffer,

      spares_current: availableForSave,

      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("characters").upsert(payload, {
      onConflict: "user_id",
    });

    if (error) setError(error.message);
    else setSavedAt(new Date().toLocaleString());

    setSaving(false);
  };

  useDebouncedEffect(
    () => {
      if (loading || saving || advancing) return;
      saveWithOverrides();
    },
    [
      shellName,
      stats,
      saveProfs,
      installedSystems,
      coreSystemId,
      frameSpecIds,
      instabilityBuffer,
      structureState,
      sparesUsed,
    ],
    1000,
    true,
  );

  const save = async () => saveWithOverrides();

  /* ---------------- System usage ---------------- */

  const useSystemById = async (systemId: string, turns?: number) => {
    const def = SYSTEMS.find((s) => s.id === systemId);
    const inferred = turns ?? parseComplexity(def?.tags);
    if (!def || inferred <= 0) return;

    const next: InstalledSystem[] = installedSystems.map((s) => {
      if (s.systemId !== systemId) return s;

      const cur = normalizeCondition(s.condition);
      if (cur.state === "destroyed") return s;

      const nextCount =
        cur.state === "disabled" ? Math.max(cur.count, inferred) : inferred;

      const nextCond: SystemCondition = { state: "disabled", count: nextCount };
      return { ...s, condition: nextCond };
    });

    setInstalledSystems(next);
    await saveWithOverrides({ installed_systems: next });
  };

  /* ---------------- Turn progression ---------------- */

  const tickOnce = (
    sys: InstalledSystem[],
    struct: StructureState,
    buffer: number[],
  ): {
    nextSystems: InstalledSystem[];
    nextStructures: StructureState;
    nextBuffer: number[];
    expired: number;
  } => {
    const nextSystems = sys.map((s) => {
      const cur = normalizeCondition(s.condition);
      if (cur.state === "destroyed") return { ...s, condition: cur };
      const next = decrementDisabled(cur);
      return { ...s, condition: next };
    });

    const nextStructures: StructureState = {
      hull: decrementDisabled(normalizeCondition(struct.hull)),
      disk: decrementDisabled(normalizeCondition(struct.disk)),
      left_arm: decrementDisabled(normalizeCondition(struct.left_arm)),
      right_arm: decrementDisabled(normalizeCondition(struct.right_arm)),
      legs: decrementDisabled(normalizeCondition(struct.legs)),
      back: decrementDisabled(normalizeCondition(struct.back)),
      core: decrementDisabled(normalizeCondition(struct.core)),
    };

    const dec = buffer.map((v) => Math.trunc(v) - 1);
    const kept = dec.filter((v) => v >= 1);
    const expired = dec.length - kept.length;

    return { nextSystems, nextStructures, nextBuffer: kept, expired };
  };

  const advanceTurns = async (mode: "one" | "fast") => {
    if (advancing || loading) return;
    setAdvancing(true);
    setError(null);

    let curSys = installedSystems;
    let curStruct = structureState;
    let curBuffer = instabilityBuffer;

    let totalExpired = 0;

    if (mode === "one") {
      const t = tickOnce(curSys, curStruct, curBuffer);
      curSys = t.nextSystems;
      curStruct = t.nextStructures;
      curBuffer = t.nextBuffer;
      totalExpired += t.expired;
    } else {
      const startHadDisabled = hasAnyDisabled(curSys, curStruct);

      if (!startHadDisabled) {
        while (curBuffer.length > 0) {
          const t = tickOnce(curSys, curStruct, curBuffer);
          curSys = t.nextSystems;
          curStruct = t.nextStructures;
          curBuffer = t.nextBuffer;

          if (t.expired > 0) {
            totalExpired += t.expired;
            break;
          }
        }
      } else {
        while (hasAnyDisabled(curSys, curStruct)) {
          const t = tickOnce(curSys, curStruct, curBuffer);
          curSys = t.nextSystems;
          curStruct = t.nextStructures;
          curBuffer = t.nextBuffer;

          if (t.expired > 0) {
            totalExpired += t.expired;
            break;
          }
        }
      }
    }

    setInstalledSystems(curSys);
    setStructureState(curStruct);
    setInstabilityBuffer(curBuffer);

    await saveWithOverrides({
      installed_systems: curSys,
      structure_state: curStruct,
      instability_buffer: curBuffer,
    });

    if (totalExpired > 0)
      setBufferCriticalPopup({ open: true, y: totalExpired });

    setAdvancing(false);
  };

  /* ---------------- Dice roller ---------------- */

  const doRoll = (expr: string) => {
    const r = rollDiceExpression(expr);
    if (!r.ok || r.total === undefined || !r.breakdown || !r.normalized) {
      setRollError(r.error ?? "Invalid roll.");
      return;
    }
    setRollError(null);
    setLastRoll({
      expr: expr.trim(),
      normalized: r.normalized,
      total: r.total,
      breakdown: r.breakdown,
    });
  };

  /* ---------------- UI toggles ---------------- */

  const showInstabilityBuffer = bufferSizeBonus >= 1;
  const instabilityCompact = instabilityBuffer.length === 0;

  const hullDestroyed = structureState.hull.state === "destroyed";
  const coreInstabilityEnabled = hullDestroyed;

  /* ---------------- Render ---------------- */

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Shell-themed background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-[28rem] w-[60rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-500/18 via-fuchsia-500/12 to-indigo-500/18 blur-3xl" />
        <div className="absolute -bottom-32 right-[-10rem] h-[26rem] w-[26rem] rounded-full bg-gradient-to-br from-amber-500/12 via-rose-500/10 to-fuchsia-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent_58%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05),transparent_58%)]" />
        <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:52px_52px]" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-4 pt-0 pb-[calc(env(safe-area-inset-bottom))]">
        {/* Header */}
        <div className="sticky top-0 z-20 -mx-4 mb-6 border-b bg-background/70 px-4 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-cyan-400/80" />
                Hangar Console
              </div>
              <h1 className="mt-3 truncate text-2xl font-semibold tracking-tight">
                Shell Configuration
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={loading || saving || advancing}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              {error}
            </div>
          )}

          <div className="min-h-[44px] rounded-md border bg-card p-3 text-sm text-muted-foreground">
            {saving ? (
              <span>Saving…</span>
            ) : savedAt ? (
              <span>Saved: {savedAt}</span>
            ) : (
              <span className="opacity-0">Saved: never</span>
            )}
          </div>
        </div>

        {/* Popups */}
        {instabilityPopup.open && (
          <Modal
            title={instabilityPopup.title}
            body={instabilityPopup.body}
            onClose={() =>
              setInstabilityPopup({ open: false, title: "", body: "" })
            }
          />
        )}

        {bufferCriticalPopup.open && (
          <Modal
            title="CRITICAL WARNING!"
            body={`${bufferCriticalPopup.y} instabilities are no longer able to be managed by the buffer and must be resolved immediately.`}
            onClose={() => setBufferCriticalPopup({ open: false, y: 0 })}
            emphasis
          />
        )}

        {/* Shell Name */}
        <ShellCard title="Shell Name">
          <div className="grid gap-2">
            <Label htmlFor="shellName">Designation</Label>
            <Input
              id="shellName"
              placeholder='e.g., DIRE-165 "Werewolf"'
              value={shellName}
              onChange={(e) => setShellName(e.target.value)}
              disabled={loading}
              maxLength={64}
              className="bg-background/40"
            />
          </div>
        </ShellCard>

        {/* Generation */}
        <ShellCard title="Generation">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Total invested points
              </div>
              <div className="text-3xl font-semibold tabular-nums">
                {generation}
                <span className="text-sm font-medium text-muted-foreground">
                  /{MAX_GENERATION}
                </span>
              </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full border bg-background/30">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400/70 via-indigo-400/60 to-fuchsia-400/60"
                style={{
                  width: `${clamp((generation / MAX_GENERATION) * 100, 0, 100)}%`,
                }}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {STAT_DEFS.map(({ key, short }) => (
                <div
                  key={key}
                  className="rounded-xl border bg-background/20 px-3 py-2 backdrop-blur"
                >
                  <div className="text-xs text-muted-foreground">{short}</div>
                  <div className="mt-1 font-medium tabular-nums">
                    {fmtSigned(invested[key])}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ShellCard>

        {/* Attributes */}
        <ShellCard title="Attributes">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STAT_DEFS.map(({ key, label }) => (
              <div
                key={key}
                className="rounded-2xl border bg-background/20 p-4 backdrop-blur transition hover:bg-background/25"
              >
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-medium">{label}</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={8}
                    max={30}
                    step={1}
                    className="w-24 text-right tabular-nums bg-background/40"
                    value={stats[key]}
                    disabled={loading}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setStat(key, Number.isFinite(n) ? n : 8);
                    }}
                    onBlur={() => setStat(key, stats[key])}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{shortMod(stats[key])}</span>
                  <span className="font-mono">
                    {fmtSigned(abilityMod(stats[key]))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ShellCard>

        {/* Derived Attributes */}
        <ShellCard title="Derived Attributes">
          <div className="grid gap-4 lg:grid-cols-2">
            <AuxCard
              title="Fort"
              value={fort}
              bonuses={[
                {
                  label: "Damage Threshold Bonus",
                  value: fmtSigned(damageThresholdBonus),
                },
                { label: "Spares Bonus", value: fmtSigned(sparesBonus) },
              ]}
            />

            <AuxCard
              title="Agility"
              value={agility}
              bonuses={[
                {
                  label: "Armor Class Bonus",
                  value: fmtSigned(armorClassBonus),
                },
                {
                  label: "Movement Speed Bonus",
                  value:
                    moveSpeedBonusFt === 0 ? "+0 ft" : `+${moveSpeedBonusFt} ft`,
                },
              ]}
            />

            <AuxCard
              title="Techno"
              value={techno}
              bonuses={[
                { label: "Save DC Bonus", value: fmtSigned(saveDCBonus) },
                {
                  label: "System Capacity Bonus",
                  value: fmtSigned(systemCapacityBonus),
                },
              ]}
            />

            <AuxCard
              title="Internal"
              value={internal}
              bonuses={[
                { label: "Buffer Size Bonus", value: fmtSigned(bufferSizeBonus) },
                {
                  label: "Buffer Duration Bonus",
                  value: fmtSigned(bufferDurationBonus),
                },
              ]}
            />
          </div>
        </ShellCard>

        {/* Tactical Profile */}
        <ShellCard title="Tactical Profile">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border bg-background/20 p-4 backdrop-blur">
              <div className="text-sm font-semibold">Vitals</div>
              <div className="mt-3 grid gap-2">
                <Row
                  label="Damage Threshold"
                  value={`${damageThreshold} (${fmtSigned(damageThresholdBonus)})`}
                />

                <div className="rounded-xl border bg-card/40 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Spares</div>
                    <div className="text-sm tabular-nums">
                      <span className="font-semibold">{sparesAvailable}</span>/
                      {sparesMax}
                    </div>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full border bg-background/30">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400/70 via-cyan-400/55 to-indigo-400/55"
                      style={{ width: `${clamp(sparesPct, 0, 100)}%` }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={useOneSpare}
                      disabled={loading || advancing || sparesAvailable <= 0}
                      className="h-8"
                    >
                      −
                    </Button>

                    <div className="text-xs text-muted-foreground font-mono">
                      {sparesUsedValue} used
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={restoreOneSpare}
                      disabled={loading || advancing || sparesUsedValue <= 0}
                      className="h-8"
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-sm font-semibold">Mobility & Defense</div>
              <div className="mt-3 grid gap-2">
                <Row
                  label="Movement Speed"
                  value={`${movementSpeedFt} ft (${
                    moveSpeedBonusFt === 0 ? "+0 ft" : `+${moveSpeedBonusFt} ft`
                  })`}
                />
                <Row
                  label="Armor Class"
                  value={`${armorClass} (${fmtSigned(armorClassBonus)})`}
                />
              </div>

              <div className="mt-6 text-sm font-semibold">Offense & Control</div>
              <div className="mt-3 grid gap-2">
                <Row label="Attack Bonus" value={fmtSigned(attackBonus)} />
                <Row
                  label="Save DC"
                  value={`${saveDC} (${fmtSigned(saveDCBonus)})`}
                />
                <Row
                  label="Forward Save Bonus"
                  value={fmtSigned(forwardSaveBonus)}
                />
              </div>

              <div className="mt-6 text-sm font-semibold">Sensors</div>
              <div className="mt-3 grid gap-2">
                <Row label="Sensor Range" value={`${sensorsRangeFt} ft`} />
              </div>

              <div className="mt-6 text-sm font-semibold">Immunities</div>
              <div className="mt-3 grid gap-2">
                <div className="rounded-xl border bg-card/40 px-3 py-2 text-sm">
                  Poison, Charmed, Exhaustion, Frightened, Poisoned
                </div>
              </div>
            </div>

            <div className="rounded-2xl border bg-background/20 p-4 backdrop-blur">
              <div className="text-sm font-semibold">Saving Throws</div>

              <div className="mt-4 grid gap-2">
                {STAT_DEFS.map(({ key, label, short }) => {
                  const mod = abilityMod(stats[key]);
                  const isProf = saveProfs.includes(key);
                  const total = saveBonus(key);
                  const disableCheck = !isProf && saveProfs.length >= 2;

                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-xl border bg-card/40 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`save-prof-${key}`}
                          checked={isProf}
                          disabled={loading || advancing || disableCheck}
                          onCheckedChange={() => toggleSaveProf(key)}
                        />
                        <label
                          htmlFor={`save-prof-${key}`}
                          className={`cursor-pointer text-sm ${
                            disableCheck ? "text-muted-foreground" : ""
                          }`}
                        >
                          {label}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({short})
                          </span>
                        </label>
                      </div>

                      <div className="text-right">
                        <div className="font-medium tabular-nums">
                          {fmtSigned(total)}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {fmtSigned(mod)}
                          {isProf ? ` + ${PROF_BONUS}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 text-sm font-semibold">Skills</div>
              <div className="mt-4 grid gap-2">
                <Row label="Athletics (STR)" value={fmtSigned(skillBonus("str"))} />
                <Row label="Acrobatics (DEX)" value={fmtSigned(skillBonus("dex"))} />
                <Row label="Perception (WIS)" value={fmtSigned(skillBonus("wis"))} />
                <Row label="Stealth (DEX)" value={fmtSigned(skillBonus("dex"))} />
              </div>
            </div>
          </div>
        </ShellCard>

        {/* Frame Specs */}
        <ShellCard title="Frame Specs">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-background/20 p-3 backdrop-blur">
              <div className="text-sm font-semibold">Select 4 Frame Specs</div>

              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground tabular-nums">
                  Selected: {frameSpecIds.length}/4
                </div>
                <Button
                  variant="outline"
                  onClick={() => setFrameSpecsOpen(true)}
                  disabled={loading || advancing}
                >
                  Choose Specs
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border bg-background/20 p-4 backdrop-blur">
              <div className="text-sm font-semibold">Selected</div>
              <div className="mt-2 grid gap-2">
                {selectedFrameSpecs.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No frame specs selected yet.
                  </div>
                ) : (
                  selectedFrameSpecs.map((s) => {
                    const tags = sortedTags((s as any).tags);

                    return (
                      <div
                        key={s.id}
                        className="rounded-2xl border bg-card/40 px-3 py-3 transition hover:bg-card/50"
                      >
                        <div className="text-sm font-medium">{s.name}</div>

                        {tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-full border bg-background/40 px-2.5 py-1 text-[11px] font-medium"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-2 text-xs text-muted-foreground">
                          {s.description}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </ShellCard>

        {/* Systems */}
        <ShellCard title="Systems">
          <div className="grid gap-4">
            <div className="rounded-2xl border bg-background/20 p-3 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Install rules: no duplicates · Hull cost cap {HULL_COST_CAP} ·
                  total cap {TOTAL_CAP}
                </div>
                <div className="text-sm font-medium tabular-nums">
                  {getTotalCost()}/{TOTAL_CAP}
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {/* Render in requested order */}
              {STRUCTURE_ORDER.map(([label, key]) => {
                if (key === "core") {
                  return (
                    <CoreSection
                      key="core"
                      title="Core"
                      subtitle={coreSystemName ? coreSystemName : "Select Core System"}
                      disabled={loading || advancing}
                      coreInstabilityEnabled={coreInstabilityEnabled}
                      pending={pendingInstability === "core"}
                      onStartInstability={() => setPendingInstability("core")}
                      onCancelInstability={() => setPendingInstability(null)}
                      onConfirmInstability={async () => {
                        setPendingInstability(null);
                        await rollInstability("core");
                      }}
                      condition={structureState.core}
                      onRepair={() => repairStructure("core")}
                      onClick={() => setCoreModalOpen(true)}
                    />
                  );
                }

                const slot = key as SystemSlot;

                const subtitle =
                  slot === "hull"
                    ? `${getSlotCost("hull")}/${HULL_COST_CAP}`
                    : `${getSlotCost(slot)}`;

                return (
                  <SectionWithInstabilityConfirm
                    key={slot}
                    title={label}
                    slot={slot}
                    subtitle={subtitle}
                    condition={structureState[slot]}
                    disabled={loading || advancing}
                    pending={pendingInstability === slot}
                    onStart={() => setPendingInstability(slot)}
                    onCancel={() => setPendingInstability(null)}
                    onConfirm={async () => {
                      setPendingInstability(null);
                      await rollInstability(slot);
                    }}
                    onRepair={() => repairStructure(slot)}
                    onClick={() => {
                      setCatalogueDefaultSlot(slot);
                      setCatalogueOpen(true);
                    }}
                  />
                );
              })}
            </div>

            <div className="rounded-2xl border bg-background/20 p-4 backdrop-blur">
              <div className="text-sm font-semibold">Installed Systems</div>
              <div className="mt-3 grid gap-2">
                {installedSystems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No systems installed yet.
                  </div>
                ) : (
                  installedSystems.map((inst) => {
                    const def = SYSTEMS.find((s) => s.id === inst.systemId);
                    const name = def?.name ?? inst.systemId;
                    const cost = def?.cost ?? getSystemCost(inst.systemId);
                    const slotLabel = SLOT_LABELS[inst.slot];
                    const tags = sortedTags(def?.tags);
                    const description = def?.description ?? "";
                    const cond = normalizeCondition(inst.condition);
                    const status = conditionLabel(cond);
                    const muted = cond.state !== "ok";
                    const complexityTurns = parseComplexity(def?.tags);

                    return (
                      <div
                        key={`${inst.systemId}:${inst.slot}`}
                        className={[
                          "rounded-2xl border bg-card/40 px-3 py-3 transition hover:bg-card/50",
                          muted ? "opacity-60" : "",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-medium">{name}</div>
                              {status && (
                                <span className="rounded-full border bg-background/40 px-2.5 py-1 text-[11px] font-medium">
                                  {status}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 text-xs text-muted-foreground">
                              Slot: {slotLabel} · Cost: {cost}
                            </div>

                            {tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {tags.map((t) => (
                                  <span
                                    key={t}
                                    className="rounded-full border bg-background/40 px-2.5 py-1 text-[11px]"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}

                            {description && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                {description}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            {complexityTurns > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  useSystemById(inst.systemId, complexityTurns)
                                }
                                disabled={loading || advancing || cond.state !== "ok"}
                                title={`Use (disables for ${complexityTurns} turns)`}
                              >
                                Use
                              </Button>
                            )}

                            {(cond.state === "disabled" ||
                              cond.state === "destroyed") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => repairSystem(inst.systemId)}
                                disabled={loading || advancing}
                              >
                                Repair
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeSystem(inst.systemId)}
                              disabled={loading || advancing}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </ShellCard>

        {/* Instability Buffer */}
        {showInstabilityBuffer && (
          <ShellCard title="Instability Buffer">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background/20 p-3 backdrop-blur">
              <div className="text-sm font-semibold">
                {instabilityBuffer.length}/{bufferSizeBonus} · {bufferDuration}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={onUnfillOne}
                  disabled={loading || advancing || !canUnfill}
                >
                  −
                </Button>
                <Button
                  onClick={onFillOne}
                  disabled={loading || advancing || !canFill}
                >
                  +
                </Button>
              </div>
            </div>

            {!instabilityCompact && (
              <div className="mt-4">
                <HexGridRowByRow
                  capacity={bufferSizeBonus}
                  filledValues={instabilityBuffer}
                  perRow={8}
                />
              </div>
            )}
          </ShellCard>
        )}

        {/* Combat */}
        <ShellCard title="Combat">
          <CombatSection
            installedSystems={[...combatInstalledSystems, ...combatFrameSpecSystems]}
            onUseSystem={(id, turns) => useSystemById(id, turns)}
          />
        </ShellCard>
      </div>

      {/* Modals */}
      <FrameSpecsModal
        open={frameSpecsOpen}
        onClose={() => setFrameSpecsOpen(false)}
        specs={FRAME_SPECS}
        selectedIds={frameSpecIds}
        maxSelected={4}
        onToggle={toggleFrameSpec}
      />

      <CoreSystemModal
        open={coreModalOpen}
        onClose={() => setCoreModalOpen(false)}
        coreSystems={CORE_SYSTEMS}
        selectedCoreSystemId={coreSystemId}
        onSelect={(id) => setCoreSystemId(id)}
        onClear={() => setCoreSystemId(null)}
      />

      <SystemCatalogueModal
        open={catalogueOpen}
        onClose={() => setCatalogueOpen(false)}
        systems={SYSTEMS}
        defaultSlot={catalogueDefaultSlot}
        installed={installedSystems as any}
        // Keep prop names compatible with your current modal; if you updated the modal earlier,
        // ensure it enforces total cap + hull cost cap and does NOT enforce per-slot count limits.
        hullCostCap={4 as any} // no longer used; kept for compatibility if your modal still expects it
        totalCap={TOTAL_CAP}
        getSystemCost={getSystemCost}
        getSlotCost={getSlotCost}
        getTotalCost={getTotalCost}
        onInstall={(systemId: string, slot: SystemSlot) => installSystem(systemId, slot)}
      />

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 p-3">
          {/* Left: Dice roller */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" disabled={loading} title="Dice Roller">
                  <Dices className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-[320px] p-3">
                <div className="text-sm font-semibold">Dice Roller</div>

                <div className="mt-3 grid gap-2">
                  <Input
                    value={rollExpr}
                    onChange={(e) => setRollExpr(e.target.value)}
                    placeholder='e.g. "12d6+6"'
                    className="bg-background/40 font-mono"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {[4, 6, 8, 10, 12, 20].map((sides) => (
                      <Button
                        key={sides}
                        variant="outline"
                        className="h-9"
                        onClick={() => {
                          const next = `d${sides}`;
                          setRollExpr(next);
                          doRoll(next);
                        }}
                      >
                        d{sides}
                      </Button>
                    ))}
                    <Button className="h-9 col-span-3" onClick={() => doRoll(rollExpr)}>
                      Roll
                    </Button>
                  </div>

                  {rollError && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
                      {rollError}
                    </div>
                  )}

                  <div className="rounded-xl border bg-background/40 p-3">
                    {lastRoll ? (
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-muted-foreground">Result</div>
                          <div className="font-mono text-sm">
                            <span className="text-muted-foreground">{lastRoll.normalized}</span>{" "}
                            →{" "}
                            <span className="font-semibold text-foreground">{lastRoll.total}</span>
                          </div>
                        </div>
                        <div className="whitespace-pre-line font-mono text-xs text-muted-foreground">
                          {lastRoll.breakdown}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground font-mono">
                        Enter an expression and roll.
                      </div>
                    )}
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {lastRoll && (
              <div className="hidden sm:flex items-center gap-2 rounded-full border bg-background/50 px-3 py-1 text-xs text-muted-foreground">
                <span className="font-mono">{lastRoll.normalized}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-semibold text-foreground">{lastRoll.total}</span>
              </div>
            )}
          </div>

          {/* Center: Turn controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => advanceTurns("one")}
              disabled={loading || saving || advancing}
              title="Advance 1 turn"
            >
              <Play className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => advanceTurns("fast")}
              disabled={loading || saving || advancing}
              title="Fast-forward (stops if buffer expires)"
            >
              <FastForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Right spacer for symmetry */}
          <div className="w-[44px]" />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Small UI helpers ---------------- */

function shortMod(score: number) {
  const m = abilityMod(score);
  return m >= 0 ? `mod +${m}` : `mod ${m}`;
}

function ShellCard(props: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-6 border bg-card/60 shadow-xl shadow-black/5 backdrop-blur">
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400/60 via-indigo-400/40 to-fuchsia-400/50" />
      </div>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{props.title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{props.children}</CardContent>
    </Card>
  );
}

function Modal(props: {
  title: string;
  body: string;
  onClose: () => void;
  emphasis?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="relative w-full max-w-md rounded-2xl border bg-card/70 p-4 shadow-2xl backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-red-500/60 via-fuchsia-500/40 to-indigo-500/60" />
        <div
          className={
            props.emphasis
              ? "flex items-center gap-2 text-lg font-semibold text-destructive"
              : "flex items-center gap-2 text-lg font-semibold"
          }
        >
          {props.emphasis ? <ShieldAlert className="h-5 w-5" /> : null}
          {props.title}
        </div>
        <div className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
          {props.body}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={props.onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card/40 px-3 py-2">
      <div className="text-sm">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}

function AuxCard(props: {
  title: string;
  value: number;
  bonuses: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="rounded-2xl border bg-background/20 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="text-base font-semibold">{props.title}</div>
        <div className="text-2xl font-semibold tabular-nums">{props.value}</div>
      </div>

      <div className="mt-3 grid gap-2">
        {props.bonuses.map((b) => (
          <div
            key={b.label}
            className="flex items-center justify-between gap-3 rounded-xl border bg-card/40 px-3 py-2"
          >
            <div className="text-sm font-medium">{b.label}</div>
            <div className="font-semibold tabular-nums">{b.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Slot cards ---------------- */

function CoreSection(props: {
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;

  coreInstabilityEnabled: boolean;

  pending: boolean;
  onStartInstability: () => void;
  onCancelInstability: () => void;
  onConfirmInstability: () => void;

  condition: SystemCondition;
  onRepair: () => void;
}) {
  const status = conditionLabel(props.condition);
  const showRepair =
    props.condition.state === "disabled" || props.condition.state === "destroyed";

  const statusIcon =
    props.condition.state === "destroyed" ? (
      <ShieldX className="h-4 w-4 text-destructive" />
    ) : props.condition.state === "disabled" ? (
      <ShieldAlert className="h-4 w-4 text-amber-500" />
    ) : (
      <ShieldCheck className="h-4 w-4 text-emerald-500" />
    );

  return (
    <div className="relative rounded-2xl border bg-background/20 px-4 py-3 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={props.onClick}
          disabled={props.disabled}
          className={[
            "min-w-0 flex-1 text-left transition-colors",
            props.disabled ? "cursor-not-allowed opacity-60" : "hover:opacity-95",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-center gap-2">
            {statusIcon}
            <div className="text-sm font-semibold">{props.title}</div>
            {status && (
              <span className="rounded-full border bg-background/40 px-2.5 py-1 text-[11px] font-medium">
                {status}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{props.subtitle}</div>
        </button>

        <div className="flex flex-col items-end gap-2">
          {props.coreInstabilityEnabled && (
            <div className="flex items-center gap-2">
              {!props.pending ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={props.onStartInstability}
                  disabled={props.disabled}
                  title="Roll Instability (Disadvantage)"
                  className="h-8 px-2"
                >
                  <span className="text-xs font-semibold">⚠</span>
                </Button>
              ) : (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={props.onCancelInstability}
                    disabled={props.disabled}
                    className="h-8 px-2"
                    title="Cancel"
                  >
                    X
                  </Button>
                  <Button
                    size="sm"
                    onClick={props.onConfirmInstability}
                    disabled={props.disabled}
                    className="h-8 px-2"
                    title="Confirm"
                  >
                    ✓
                  </Button>
                </>
              )}
            </div>
          )}

          {showRepair && (
            <Button
              variant="outline"
              size="sm"
              onClick={props.onRepair}
              disabled={props.disabled}
              className="h-8"
            >
              Repair
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionWithInstabilityConfirm(props: {
  title: string;
  slot: SystemSlot;
  subtitle: string;
  condition: SystemCondition;

  disabled?: boolean;

  pending: boolean;
  onStart: () => void;
  onCancel: () => void;
  onConfirm: () => void;

  onRepair: () => void;
  onClick: () => void;
}) {
  const status = conditionLabel(props.condition);
  const showRepair =
    props.condition.state === "disabled" || props.condition.state === "destroyed";

  const statusIcon =
    props.condition.state === "destroyed" ? (
      <ShieldX className="h-4 w-4 text-destructive" />
    ) : props.condition.state === "disabled" ? (
      <ShieldAlert className="h-4 w-4 text-amber-500" />
    ) : (
      <ShieldCheck className="h-4 w-4 text-emerald-500" />
    );

  return (
    <div className="relative rounded-2xl border bg-background/20 px-4 py-3 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={props.onClick}
          disabled={props.disabled}
          className={[
            "min-w-0 flex-1 text-left transition-colors",
            props.disabled ? "cursor-not-allowed opacity-60" : "hover:opacity-95",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-center gap-2">
            {statusIcon}
            <div className="text-sm font-semibold">{props.title}</div>
            {status && (
              <span className="rounded-full border bg-background/40 px-2.5 py-1 text-[11px] font-medium">
                {status}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{props.subtitle}</div>
        </button>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {!props.pending ? (
              <Button
                variant="outline"
                size="sm"
                onClick={props.onStart}
                disabled={props.disabled}
                title="Roll Instability"
                className="h-8 px-2"
              >
                <span className="text-xs font-semibold">⚠</span>
              </Button>
            ) : (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={props.onCancel}
                  disabled={props.disabled}
                  className="h-8 px-2"
                  title="Cancel"
                >
                  X
                </Button>
                <Button
                  size="sm"
                  onClick={props.onConfirm}
                  disabled={props.disabled}
                  className="h-8 px-2"
                  title="Confirm"
                >
                  ✓
                </Button>
              </>
            )}
          </div>

          {showRepair && (
            <Button
              variant="outline"
              size="sm"
              onClick={props.onRepair}
              disabled={props.disabled}
              className="h-8"
            >
              Repair
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Hex grid ---------------- */

function HexGridRowByRow(props: {
  capacity: number;
  filledValues: number[];
  perRow: number;
}) {
  const { capacity, filledValues, perRow } = props;
  const filled = filledValues.length;

  const rowsNeeded = Math.max(1, Math.ceil(filled / perRow));
  const displayCount = Math.min(capacity, rowsNeeded * perRow);

  const cells = Array.from({ length: displayCount }, (_, i) => {
    const isFilled = i < filled;
    const value = isFilled ? filledValues[i] : null;
    return { isFilled, value, key: i };
  });

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}
    >
      {cells.map((c) => (
        <HexCell key={c.key} filled={c.isFilled} value={c.value} />
      ))}
    </div>
  );
}

function HexCell(props: { filled: boolean; value: number | null }) {
  return (
    <div
      className={[
        "aspect-square w-full",
        "flex items-center justify-center",
        "border",
        "rounded-md",
        props.filled ? "bg-accent text-accent-foreground" : "bg-background/10",
      ].join(" ")}
      style={{
        clipPath:
          "polygon(25% 6.7%, 75% 6.7%, 100% 50%, 75% 93.3%, 25% 93.3%, 0% 50%)",
      }}
      aria-label={props.filled ? `Filled: ${props.value}` : "Empty"}
    >
      {props.filled ? (
        <span className="text-sm font-semibold tabular-nums">{props.value}</span>
      ) : null}
    </div>
  );
}
