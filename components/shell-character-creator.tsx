"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { Play, FastForward } from "lucide-react";

import { SYSTEMS, type SystemSlot } from "@/lib/systems/systems";
import { SystemCatalogueModal } from "@/components/system-catalogue-modal";

import { CORE_SYSTEMS } from "@/lib/systems/core-systems";
import { FRAME_SPECS } from "@/lib/frame-specs/frame-specs";
import { CoreSystemModal } from "@/components/core-system-modal";
import { FrameSpecsModal } from "@/components/frame-specs-modal";

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

const STAT_DEFS: Array<{ key: AbilityKey; label: string; short: string }> = [
  { key: "str", label: "Strength", short: "STR" },
  { key: "dex", label: "Dexterity", short: "DEX" },
  { key: "con", label: "Constitution", short: "CON" },
  { key: "int", label: "Intelligence", short: "INT" },
  { key: "wis", label: "Wisdom", short: "WIS" },
  { key: "cha", label: "Charisma", short: "CHA" },
];

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const DEFAULT_STATS: Stats = {
  str: 8,
  dex: 8,
  con: 8,
  int: 8,
  wis: 8,
  cha: 8,
};

const fmtSigned = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const abilityMod = (score: number) => Math.floor((score - 10) / 2);

const PROF_BONUS = 6;
const PER_SLOT_CAP = 6;

const SLOT_LABELS: Record<SystemSlot, string> = {
  hull: "Hull",
  left_arm: "Left Arm",
  right_arm: "Right Arm",
  legs: "Legs",
  back: "Back",
};

function isSystemSlot(x: unknown): x is SystemSlot {
  return (
    x === "hull" ||
    x === "left_arm" ||
    x === "right_arm" ||
    x === "legs" ||
    x === "back"
  );
}

function sortedTags(tags?: string[]) {
  return (tags ?? []).slice().sort((a, b) => a.localeCompare(b));
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

function isEligibleForTarget(c: SystemCondition) {
  return c.state !== "destroyed";
}

function pickRandom<T>(arr: T[]) {
  if (arr.length === 0) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

type RollMode = "normal" | "adv" | "dis";

function decrementDisabled(cond: SystemCondition): SystemCondition {
  // Destroyed never changes via play/fast-forward
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

  const [structureState, setStructureState] = useState<StructureState>({
    hull: { state: "ok" },
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

  const [sparesCurrent, setSparesCurrent] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const setStat = (key: AbilityKey, value: number) => {
    setStats((prev) => ({
      ...prev,
      [key]: clamp(value, 8, 30),
    }));
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

  // ---------- Derived values ----------
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

  // Buffer Duration base is 1 (min 1)
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

  useEffect(() => {
    setSparesCurrent((prev) => {
      if (prev === null || prev === undefined) return sparesMax;
      return clamp(prev, 0, sparesMax);
    });
  }, [sparesMax]);

  const incSpares = () =>
    setSparesCurrent((prev) =>
      prev === null ? sparesMax : clamp(prev + 1, 0, sparesMax),
    );
  const decSpares = () =>
    setSparesCurrent((prev) =>
      prev === null ? 0 : clamp(prev - 1, 0, sparesMax),
    );

  const saveBonus = (key: AbilityKey) =>
    abilityMod(stats[key]) + (saveProfs.includes(key) ? PROF_BONUS : 0);

  const skillBonus = (key: AbilityKey) => abilityMod(stats[key]) + PROF_BONUS;

  const TOTAL_CAP = 19 + systemCapacityBonus;

  // If Buffer Size shrinks, trim buffer
  useEffect(() => {
    setInstabilityBuffer((prev) => prev.slice(0, Math.max(0, bufferSizeBonus)));
  }, [bufferSizeBonus]);

  // Instability buffer controls
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

  // Systems cost helpers
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

  const installSystem = (systemId: string, slot: SystemSlot) => {
    if (installedSystemIdSet.has(systemId)) return;

    const cost = getSystemCost(systemId);
    const wouldSlot = getSlotCost(slot) + cost;
    const wouldTotal = getTotalCost() + cost;

    if (wouldSlot > PER_SLOT_CAP) return;
    if (wouldTotal > TOTAL_CAP) return;

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

  // ---------- Instability rolling ----------
  const getRollModeFor = (slot: StructureKey): RollMode => {
    if (slot === "core") return "dis";
    if (slot === "hull") {
      const hull = structureState.hull;
      if (hull.state === "disabled") return "normal";
      return "adv";
    }
    return "normal";
  };

  const rollInstability = async (slot: StructureKey) => {
    setError(null);

    const mode = getRollModeFor(slot);

    let rolls: number[] = [];
    let result: number | null = null;

    try {
      const res = await fetch("/api/instability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error(`Instability roll failed (${res.status})`);
      const json = (await res.json()) as {
        mode: RollMode;
        rolls: number[];
        result: number;
      };

      rolls = Array.isArray(json.rolls) ? json.rolls.map(Number) : [];
      result = Number(json.result);

      if (
        !Number.isFinite(result) ||
        result < 1 ||
        result > 6 ||
        rolls.some((r) => !Number.isFinite(r) || r < 1 || r > 6)
      ) {
        throw new Error("Invalid roll result returned by backend.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to roll instability.");
      return;
    }

    const rollHeader =
      rolls.length === 2
        ? `${mode === "adv" ? "Advantage" : "Disadvantage"}: [${rolls[0]}, ${rolls[1]}] → ${result}`
        : `Roll: ${result}`;

    if (result >= 4) {
      setInstabilityPopup({
        open: true,
        title: `Instability (${slot === "core" ? "Core" : SLOT_LABELS[slot]})`,
        body: `${rollHeader}\nNo effect.`,
      });
      return;
    }

    // Core: structure only, not core system
    if (slot === "core") {
      const curNow = normalizeCondition(structureState.core);

      const nextCore =
        result === 1
          ? ({ state: remindingDestroyed(curNow) ? "destroyed" : "destroyed" } as SystemCondition)
          : curNow.state === "destroyed"
            ? curNow
            : curNow.state === "disabled"
              ? ({ state: "disabled", count: curNow.count + 1 } as SystemCondition)
              : ({ state: "disabled", count: 2 } as SystemCondition);

      setStructureState((prev) => ({ ...prev, core: nextCore }));

      const outcome =
        result === 1
          ? "Destroyed"
          : curNow.state === "disabled"
            ? `Disabled: ${curNow.count + 1}`
            : "Disabled: 2";

      setInstabilityPopup({
        open: true,
        title: `Instability (Core)`,
        body: `${rollHeader}\nCore structure is now ${outcome}.`,
      });
      return;
    }

    const candidates = installedSystems
      .filter((s) => s.slot === slot)
      .map((s) => ({
        ...s,
        condition: normalizeCondition(s.condition),
      }))
      .filter((s) => isEligibleForTarget(s.condition));

    const targetSystem = pickRandom(candidates);

    const applyToStructure = () => {
      const cur = normalizeCondition(structureState[slot]);

      const next =
        result === 1
          ? ({ state: "destroyed" } as SystemCondition)
          : cur.state === "destroyed"
            ? cur
            : cur.state === "disabled"
              ? ({ state: "disabled", count: cur.count + 1 } as SystemCondition)
              : ({ state: "disabled", count: 2 } as SystemCondition);

      setStructureState((prev) => ({ ...prev, [slot]: next }));

      const outcome =
        result === 1
          ? "Destroyed"
          : cur.state === "disabled"
            ? `Disabled: ${cur.count + 1}`
            : "Disabled: 2";

      setInstabilityPopup({
        open: true,
        title: `Instability (${SLOT_LABELS[slot]})`,
        body: `${rollHeader}\nNo eligible systems. ${SLOT_LABELS[slot]} structure is now ${outcome}.`,
      });
    };

    if (!targetSystem) {
      applyToStructure();
      return;
    }

    const sysDef = SYSTEMS.find((x) => x.id === targetSystem.systemId);
    const sysName = sysDef?.name ?? targetSystem.systemId;

    const curCond = normalizeCondition(targetSystem.condition);

    setInstalledSystems((prev) =>
      prev.map((s) => {
        if (s.systemId !== targetSystem.systemId) return s;

        const cur = normalizeCondition(s.condition);

        if (result === 1) return { ...s, condition: { state: "destroyed" } };

        if (cur.state === "destroyed") return s;

        if (cur.state === "disabled") {
          return { ...s, condition: { state: "disabled", count: cur.count + 1 } };
        }

        return { ...s, condition: { state: "disabled", count: 2 } };
      }),
    );

    const outcome =
      result === 1
        ? "Destroyed"
        : curCond.state === "disabled"
          ? `Disabled: ${curCond.count + 1}`
          : "Disabled: 2";

    setInstabilityPopup({
      open: true,
      title: `Instability (${SLOT_LABELS[slot]})`,
      body: `${rollHeader}\n${sysName} is now ${outcome}.`,
    });
  };

  function remindingDestroyed(_c: SystemCondition) {
    // Helper only to keep TS happy if you later special-case; currently always returns false.
    return false;
  }

  // ---------- Load ----------
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
            .filter((x: any) => typeof x.systemId === "string" && isSystemSlot(x.slot))
            .map((x: any) => ({ systemId: x.systemId, slot: x.slot, condition: x.condition }));
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
            left_arm: normalizeCondition(rawStructureState.left_arm),
            right_arm: normalizeCondition(rawStructureState.right_arm),
            legs: normalizeCondition(rawStructureState.legs),
            back: normalizeCondition(rawStructureState.back),
            core: normalizeCondition(rawStructureState.core),
          });
        } else {
          setStructureState({
            hull: { state: "ok" },
            left_arm: { state: "ok" },
            right_arm: { state: "ok" },
            legs: { state: "ok" },
            back: { state: "ok" },
            core: { state: "ok" },
          });
        }

        const sc = (data as any).spares_current;
        if (Number.isFinite(Number(sc))) {
          setSparesCurrent(Math.max(0, Math.trunc(Number(sc))));
        } else {
          setSparesCurrent(null);
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
          left_arm: { state: "ok" },
          right_arm: { state: "ok" },
          legs: { state: "ok" },
          back: { state: "ok" },
          core: { state: "ok" },
        });
        setSparesCurrent(null);
      }

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  // ---------- Save (full payload) ----------
  const saveWithOverrides = async (overrides?: Partial<{
    installed_systems: InstalledSystem[];
    structure_state: StructureState;
    instability_buffer: number[];
    spares_current: number;
  }>) => {
    setSaving(true);
    setError(null);
    setSavedAt(null);

    const normalizedBuffer =
      bufferSizeBonus >= 1
        ? (overrides?.instability_buffer ?? instabilityBuffer).slice(0, bufferSizeBonus)
        : [];

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

      spares_current:
        overrides?.spares_current ??
        (sparesCurrent === null ? sparesMax : clamp(sparesCurrent, 0, sparesMax)),

      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("characters").upsert(payload, {
      onConflict: "user_id",
    });

    if (error) {
      setError(error.message);
    } else {
      setSavedAt(new Date().toLocaleString());
    }

    setSaving(false);
  };

  const save = async () => saveWithOverrides();

  // ---------- Turn progression ----------
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
        // fast-forward:
        // - if Disabled exists, advance until all Disabled cleared (stop if buffer expires)
        // - if no Disabled exists, advance until buffer expires something (stop) or buffer is empty
        const startHadDisabled = hasAnyDisabled(curSys, curStruct);

        if (!startHadDisabled) {
        while (curBuffer.length > 0) {
            const t = tickOnce(curSys, curStruct, curBuffer);
            curSys = t.nextSystems;
            curStruct = t.nextStructures;
            curBuffer = t.nextBuffer;

            if (t.expired > 0) {
            totalExpired += t.expired;
            break; // triggers Critical Warning popup after loop
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
            break; // interrupt fast-forward on buffer expiry
            }
        }
        }
    }


    // Apply locally
    setInstalledSystems(curSys);
    setStructureState(curStruct);
    setInstabilityBuffer(curBuffer);

    // Persist immediately
    await saveWithOverrides({
      installed_systems: curSys,
      structure_state: curStruct,
      instability_buffer: curBuffer,
    });

    if (totalExpired > 0) {
      setBufferCriticalPopup({ open: true, y: totalExpired });
    }

    setAdvancing(false);
  };

  // Instability Buffer UI behavior
  const showInstabilityBuffer = bufferSizeBonus >= 1;
  const instabilityCompact = filledCount === 0;

  // Core instability allowed ONLY when Hull destroyed
  const hullDestroyed = structureState.hull.state === "destroyed";
  const coreInstabilityEnabled = hullDestroyed;

  return (
    <div className="flex w-full flex-col gap-6 pb-28">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shell Configuration</h1>
          <p className="text-sm text-muted-foreground">
            Configure attributes, frame specs, systems, and instabilities.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={loading || saving || advancing}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </div>
      )}

      {savedAt && (
        <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
          Saved: {savedAt}
        </div>
      )}

      {/* Instability result popup */}
      {instabilityPopup.open && (
        <Modal
          title={instabilityPopup.title}
          body={instabilityPopup.body}
          onClose={() => setInstabilityPopup({ open: false, title: "", body: "" })}
        />
      )}

      {/* Buffer critical popup */}
      {bufferCriticalPopup.open && (
        <Modal
          title="CRITICAL WARNING!"
          body={`${bufferCriticalPopup.y} instabilities are no longer able to be managed by the buffer and must be resolved immediately.`}
          onClose={() => setBufferCriticalPopup({ open: false, y: 0 })}
          emphasis
        />
      )}

      {/* Shell Name */}
      <Card>
        <CardHeader>
          <CardTitle>Shell Name</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Label htmlFor="shellName">Designation</Label>
            <Input
              id="shellName"
              placeholder='e.g., HANGAR-07 “Kestrel”'
              value={shellName}
              onChange={(e) => setShellName(e.target.value)}
              disabled={loading}
              maxLength={64}
            />
          </div>
        </CardContent>
      </Card>

      {/* Generation */}
      <Card>
        <CardHeader>
          <CardTitle>Generation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <div className="text-sm text-muted-foreground">
                Total invested points (above 8)
              </div>
              <div className="text-3xl font-semibold tabular-nums">{generation}</div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {STAT_DEFS.map(({ key, short }) => (
                <div key={key} className="rounded-lg border bg-background/20 px-3 py-2">
                  <div className="text-xs text-muted-foreground">{short}</div>
                  <div className="mt-1 font-medium tabular-nums">{fmtSigned(invested[key])}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attributes */}
      <Card>
        <CardHeader>
          <CardTitle>Attributes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STAT_DEFS.map(({ key, label }) => (
              <div key={key} className="rounded-lg border bg-background/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-medium">{label}</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={8}
                    max={30}
                    step={1}
                    className="w-24 text-right tabular-nums"
                    value={stats[key]}
                    disabled={loading}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setStat(key, Number.isFinite(n) ? n : 8);
                    }}
                    onBlur={() => setStat(key, stats[key])}
                  />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Min 8 · Max 30 · Default 8
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Derived Attributes */}
      <Card>
        <CardHeader>
          <CardTitle>Derived Attributes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            <AuxCard
              title="Fort"
              value={fort}
              contribution="Contrib: STR + CON + CHA (per 3)"
              bonuses={[
                { label: "Damage Threshold Bonus", value: fmtSigned(damageThresholdBonus), detail: "+2 per Fort" },
                { label: "Spares Bonus", value: fmtSigned(sparesBonus), detail: "+1 per 2 Fort" },
              ]}
            />

            <AuxCard
              title="Agility"
              value={agility}
              contribution="Contrib: 2×DEX + WIS (per 3)"
              bonuses={[
                { label: "Armor Class Bonus", value: fmtSigned(armorClassBonus), detail: "+1 per Agility" },
                {
                  label: "Movement Speed Bonus",
                  value: moveSpeedBonusFt === 0 ? "+0 ft" : `+${moveSpeedBonusFt} ft`,
                  detail: "+10 ft per 2 Agility",
                },
              ]}
            />

            <AuxCard
              title="Techno"
              value={techno}
              contribution="Contrib: INT + WIS + CHA (per 3)"
              bonuses={[
                { label: "Save DC Bonus", value: fmtSigned(saveDCBonus), detail: "+1 per Techno" },
                { label: "System Capacity Bonus", value: fmtSigned(systemCapacityBonus), detail: "+1 per 2 Techno" },
              ]}
            />

            <AuxCard
              title="Internal"
              value={internal}
              contribution="Contrib: STR + CON + INT (per 3)"
              bonuses={[
                { label: "Buffer Size Bonus", value: fmtSigned(bufferSizeBonus), detail: "+1 per Internal" },
                { label: "Buffer Duration Bonus", value: fmtSigned(bufferDurationBonus), detail: "+1 per 2 Internal" },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tactical Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Tactical Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border bg-background/20 p-4">
              <div className="text-sm font-semibold">Vitals</div>
              <div className="mt-3 grid gap-2">
                <Row
                  label="Damage Threshold"
                  value={`${damageThreshold} (${fmtSigned(damageThresholdBonus)})`}
                />

                {/* Spares current/max */}
                <div className="flex items-center justify-between rounded-md border bg-card/40 px-3 py-2">
                  <div>Spares</div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={decSpares}
                      disabled={loading || advancing || (sparesCurrent ?? sparesMax) <= 0}
                    >
                      −
                    </Button>
                    <div className="font-medium tabular-nums">
                      {clamp(sparesCurrent ?? sparesMax, 0, sparesMax)}/{sparesMax}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({fmtSigned(sparesBonus)})
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={incSpares}
                      disabled={loading || advancing || (sparesCurrent ?? sparesMax) >= sparesMax}
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
                  value={`${movementSpeedFt} ft (${moveSpeedBonusFt === 0 ? "+0 ft" : `+${moveSpeedBonusFt} ft`})`}
                />
                <Row label="Armor Class" value={`${armorClass} (${fmtSigned(armorClassBonus)})`} />
              </div>

              <div className="mt-6 text-sm font-semibold">Offense & Control</div>
              <div className="mt-3 grid gap-2">
                <Row label="Attack Bonus" value={fmtSigned(attackBonus)} />
                <Row label="Save DC" value={`${saveDC} (${fmtSigned(saveDCBonus)})`} />
                <Row label="Forward Save Bonus" value={fmtSigned(forwardSaveBonus)} />
              </div>

              <div className="mt-6 text-sm font-semibold">Sensors</div>
              <div className="mt-3 grid gap-2">
                <Row label="Sensors Range" value={`${sensorsRangeFt} ft`} />
              </div>

              {/* NEW: Immunities section */}
              <div className="mt-6 text-sm font-semibold">Immunities</div>
              <div className="mt-3 grid gap-2">
                <div className="rounded-md border bg-card/40 px-3 py-2 text-sm">
                  Poison, Charmed, Exhaustion, Frightened, Poisoned
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-background/20 p-4">
              <div className="text-sm font-semibold">Saving Throws</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Choose exactly two save proficiencies. Proficiency bonus is {fmtSigned(PROF_BONUS)}.
              </div>

              <div className="mt-4 grid gap-2">
                {STAT_DEFS.map(({ key, label, short }) => {
                  const mod = abilityMod(stats[key]);
                  const isProf = saveProfs.includes(key);
                  const total = saveBonus(key);
                  const disableCheck = !isProf && saveProfs.length >= 2;

                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-md border bg-card/40 px-3 py-2"
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
                          className={`cursor-pointer text-sm ${disableCheck ? "text-muted-foreground" : ""}`}
                        >
                          {label}{" "}
                          <span className="text-xs text-muted-foreground">({short})</span>
                        </label>
                      </div>

                      <div className="text-right">
                        <div className="font-medium tabular-nums">{fmtSigned(total)}</div>
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
              <div className="mt-1 text-xs text-muted-foreground">
                Shells are proficient in Athletics, Acrobatics, Perception, and Stealth. Proficiency bonus is{" "}
                {fmtSigned(PROF_BONUS)}.
              </div>

              <div className="mt-4 grid gap-2">
                <Row label="Athletics (STR)" value={fmtSigned(skillBonus("str"))} />
                <Row label="Acrobatics (DEX)" value={fmtSigned(skillBonus("dex"))} />
                <Row label="Perception (WIS)" value={fmtSigned(skillBonus("wis"))} />
                <Row label="Stealth (DEX)" value={fmtSigned(skillBonus("dex"))} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Frame Specs */}
      <Card>
        <CardHeader>
          <CardTitle>Frame Specs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border bg-background/20 p-3">
              <div>
                <div className="text-sm font-semibold">Select 4 Frame Specs</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground tabular-nums">
                  Selected: {frameSpecIds.length}/4
                </div>
                <Button variant="outline" onClick={() => setFrameSpecsOpen(true)} disabled={loading || advancing}>
                  Choose Specs
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-background/20 p-4">
              <div className="text-sm font-semibold">Selected</div>
              <div className="mt-2 grid gap-2">
                {selectedFrameSpecs.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No frame specs selected yet.</div>
                ) : (
                  selectedFrameSpecs.map((s) => (
                    <div key={s.id} className="rounded-md border bg-card/40 px-3 py-2">
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{s.description}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <FrameSpecsModal
              open={frameSpecsOpen}
              onClose={() => setFrameSpecsOpen(false)}
              specs={FRAME_SPECS}
              selectedIds={frameSpecIds}
              maxSelected={4}
              onToggle={toggleFrameSpec}
            />
          </div>
        </CardContent>
      </Card>

      {/* Systems */}
      <Card>
        <CardHeader>
          <CardTitle>Systems</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="rounded-md border bg-background/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Per-site cap: {PER_SLOT_CAP}. Total cap: {TOTAL_CAP}.
                </div>
                <div className="text-sm font-medium tabular-nums">
                  Total Installed Cost: {getTotalCost()}/{TOTAL_CAP}
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <CoreSection
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

              <SectionWithInstabilityConfirm
                title="Hull"
                slot="hull"
                subtitle={`${getSlotCost("hull")}/${PER_SLOT_CAP}`}
                condition={structureState.hull}
                disabled={loading || advancing}
                pending={pendingInstability === "hull"}
                onStart={() => setPendingInstability("hull")}
                onCancel={() => setPendingInstability(null)}
                onConfirm={async () => {
                  setPendingInstability(null);
                  await rollInstability("hull");
                }}
                onRepair={() => repairStructure("hull")}
                onClick={() => {
                  setCatalogueDefaultSlot("hull");
                  setCatalogueOpen(true);
                }}
              />

              <SectionWithInstabilityConfirm
                title="Left Arm"
                slot="left_arm"
                subtitle={`${getSlotCost("left_arm")}/${PER_SLOT_CAP}`}
                condition={structureState.left_arm}
                disabled={loading || advancing}
                pending={pendingInstability === "left_arm"}
                onStart={() => setPendingInstability("left_arm")}
                onCancel={() => setPendingInstability(null)}
                onConfirm={async () => {
                  setPendingInstability(null);
                  await rollInstability("left_arm");
                }}
                onRepair={() => repairStructure("left_arm")}
                onClick={() => {
                  setCatalogueDefaultSlot("left_arm");
                  setCatalogueOpen(true);
                }}
              />

              <SectionWithInstabilityConfirm
                title="Right Arm"
                slot="right_arm"
                subtitle={`${getSlotCost("right_arm")}/${PER_SLOT_CAP}`}
                condition={structureState.right_arm}
                disabled={loading || advancing}
                pending={pendingInstability === "right_arm"}
                onStart={() => setPendingInstability("right_arm")}
                onCancel={() => setPendingInstability(null)}
                onConfirm={async () => {
                  setPendingInstability(null);
                  await rollInstability("right_arm");
                }}
                onRepair={() => repairStructure("right_arm")}
                onClick={() => {
                  setCatalogueDefaultSlot("right_arm");
                  setCatalogueOpen(true);
                }}
              />

              <SectionWithInstabilityConfirm
                title="Legs"
                slot="legs"
                subtitle={`${getSlotCost("legs")}/${PER_SLOT_CAP}`}
                condition={structureState.legs}
                disabled={loading || advancing}
                pending={pendingInstability === "legs"}
                onStart={() => setPendingInstability("legs")}
                onCancel={() => setPendingInstability(null)}
                onConfirm={async () => {
                  setPendingInstability(null);
                  await rollInstability("legs");
                }}
                onRepair={() => repairStructure("legs")}
                onClick={() => {
                  setCatalogueDefaultSlot("legs");
                  setCatalogueOpen(true);
                }}
              />

              <SectionWithInstabilityConfirm
                title="Back"
                slot="back"
                subtitle={`${getSlotCost("back")}/${PER_SLOT_CAP}`}
                condition={structureState.back}
                disabled={loading || advancing}
                pending={pendingInstability === "back"}
                onStart={() => setPendingInstability("back")}
                onCancel={() => setPendingInstability(null)}
                onConfirm={async () => {
                  setPendingInstability(null);
                  await rollInstability("back");
                }}
                onRepair={() => repairStructure("back")}
                onClick={() => {
                  setCatalogueDefaultSlot("back");
                  setCatalogueOpen(true);
                }}
              />
            </div>

            <CoreSystemModal
              open={coreModalOpen}
              onClose={() => setCoreModalOpen(false)}
              coreSystems={CORE_SYSTEMS}
              selectedCoreSystemId={coreSystemId}
              onSelect={(id) => setCoreSystemId(id)}
              onClear={() => setCoreSystemId(null)}
            />

            <div className="rounded-lg border bg-background/20 p-4">
              <div className="text-sm font-semibold">Installed Systems</div>
              <div className="mt-2 grid gap-2">
                {installedSystems.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No systems installed yet.</div>
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

                    return (
                      <div
                        key={`${inst.systemId}:${inst.slot}`}
                        className={[
                          "rounded-md border bg-card/40 px-3 py-2",
                          muted ? "opacity-60" : "",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-medium">{name}</div>
                              {status && (
                                <span className="rounded-md border bg-background/40 px-2 py-0.5 text-xs font-medium">
                                  {status}
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              Slot: {slotLabel} · Cost: {cost}
                            </div>

                            {tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {tags.map((t) => (
                                  <span
                                    key={t}
                                    className="rounded-md border bg-background/40 px-2 py-0.5 text-xs"
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
                            {(cond.state === "disabled" || cond.state === "destroyed") && (
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

            <SystemCatalogueModal
              open={catalogueOpen}
              onClose={() => setCatalogueOpen(false)}
              systems={SYSTEMS}
              defaultSlot={catalogueDefaultSlot}
              installed={installedSystems as any}
              perSlotCap={PER_SLOT_CAP}
              totalCap={TOTAL_CAP}
              getSystemCost={getSystemCost}
              getSlotCost={getSlotCost}
              getTotalCost={getTotalCost}
              onInstall={(systemId: string, slot: SystemSlot) => installSystem(systemId, slot)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Instability Buffer */}
      {showInstabilityBuffer && (
        <Card>
          <CardHeader className={instabilityCompact ? "py-4" : undefined}>
            <CardTitle>Instability Buffer</CardTitle>
          </CardHeader>

          <CardContent className={instabilityCompact ? "pt-0" : undefined}>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background/20 p-3">
              <div>
                <div className="text-sm font-semibold">
                  Buffer Size {bufferSizeBonus} · Buffer Duration {bufferDuration}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={onUnfillOne}
                  disabled={loading || advancing || !canUnfill}
                >
                  −
                </Button>
                <div className="text-sm tabular-nums">
                  {filledCount}/{bufferSizeBonus}
                </div>
                <Button onClick={onFillOne} disabled={loading || advancing || !canFill}>
                  +
                </Button>
              </div>
            </div>

            {filledCount > 0 && (
              <div className="mt-4">
                <HexGridRowByRow
                  capacity={bufferSizeBonus}
                  filledValues={instabilityBuffer}
                  perRow={8}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bottom controls (very bottom) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-end gap-3 p-3">
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
            title="Fast-forward until all Disabled cleared (stops if buffer expires)"
          >
            <FastForward className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- UI helpers ---------- */

function Modal(props: {
  title: string;
  body: string;
  onClose: () => void;
  emphasis?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-4 shadow">
        <div className={props.emphasis ? "text-lg font-semibold text-destructive" : "text-lg font-semibold"}>
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
    <div className="flex items-center justify-between rounded-md border bg-card/40 px-3 py-2">
      <div>{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}

function AuxCard(props: {
  title: string;
  value: number;
  contribution: string;
  bonuses: Array<{ label: string; value: string; detail: string }>;
}) {
  return (
    <div className="rounded-lg border bg-background/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">{props.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{props.contribution}</div>
        </div>
        <div className="text-2xl font-semibold tabular-nums">{props.value}</div>
      </div>

      <div className="mt-3 grid gap-2">
        {props.bonuses.map((b) => (
          <div
            key={b.label}
            className="flex items-start justify-between gap-3 rounded-md border bg-card/40 px-3 py-2"
          >
            <div>
              <div className="text-sm font-medium">{b.label}</div>
              <div className="text-xs text-muted-foreground">{b.detail}</div>
            </div>
            <div className="font-semibold tabular-nums">{b.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const showRepair = props.condition.state === "disabled" || props.condition.state === "destroyed";

  return (
    <div className="relative rounded-lg border bg-background/20 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={props.onClick}
          disabled={props.disabled}
          className={[
            "min-w-0 flex-1 text-left transition-colors",
            props.disabled ? "cursor-not-allowed opacity-60" : "",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold">{props.title}</div>
            {status && (
              <span className="rounded-md border bg-background/40 px-2 py-0.5 text-xs font-medium">
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
  const showRepair = props.condition.state === "disabled" || props.condition.state === "destroyed";

  return (
    <div className="relative rounded-lg border bg-background/20 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={props.onClick}
          disabled={props.disabled}
          className={[
            "min-w-0 flex-1 text-left transition-colors",
            props.disabled ? "cursor-not-allowed opacity-60" : "",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold">{props.title}</div>
            {status && (
              <span className="rounded-md border bg-background/40 px-2 py-0.5 text-xs font-medium">
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

/**
 * Renders only as many hexes as needed to cover the filled count, row-by-row.
 */
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
