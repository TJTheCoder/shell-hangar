"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { SYSTEMS, type SystemSlot } from "@/lib/systems/systems";
import {
  SystemCatalogueModal,
  type InstalledSystem,
} from "@/components/system-catalogue-modal";

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

export function ShellCharacterCreator({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);

  const [shellName, setShellName] = useState("");
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);

  // saving throw proficiencies (choose 2)
  const [saveProfs, setSaveProfs] = useState<AbilityKey[]>([]);

  // core system (exactly one)
  const [coreSystemId, setCoreSystemId] = useState<string | null>(null);
  const [coreModalOpen, setCoreModalOpen] = useState(false);

  // frame specs (pick 4)
  const [frameSpecIds, setFrameSpecIds] = useState<string[]>([]);
  const [frameSpecsOpen, setFrameSpecsOpen] = useState(false);

  // systems
  const [installedSystems, setInstalledSystems] = useState<InstalledSystem[]>(
    [],
  );
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [catalogueDefaultSlot, setCatalogueDefaultSlot] =
    useState<SystemSlot>("hull");

  // ui state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  // Aux stats: +1 per 3 contribution points
  const fort = Math.floor((invested.str + invested.con + invested.cha) / 3);
  const agility = Math.floor((2 * invested.dex + invested.wis) / 3);
  const techno = Math.floor((invested.int + invested.wis + invested.cha) / 3);
  const internal = Math.floor((invested.str + invested.con + invested.int) / 3);

  // Tertiary bonuses derived from aux stats
  const damageThresholdBonus = fort * 2;
  const sparesBonus = Math.floor(fort / 2);

  const acBonus = agility;
  const moveSpeedBonusFt = Math.floor(agility / 2) * 10;

  const saveDCBonus = techno;
  const savingThrowsBonus = techno;
  const systemCapacityBonus = Math.floor(techno / 2);

  const bufferSizeBonus = internal;
  const bufferDurationBonus = Math.floor(internal / 2);

  // Saving throws + skills
  const saveBonus = (key: AbilityKey) =>
    abilityMod(stats[key]) + (saveProfs.includes(key) ? PROF_BONUS : 0);

  const skillBonus = (key: AbilityKey) => abilityMod(stats[key]) + PROF_BONUS;

  const sensorsRangeFt = 100;

  // Systems caps
  const TOTAL_CAP = 19 + systemCapacityBonus;

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

    setInstalledSystems((prev) => [...prev, { systemId, slot }]);
  };

  const removeSystem = (systemId: string) => {
    setInstalledSystems((prev) => prev.filter((x) => x.systemId !== systemId));
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
          "shell_name,str,dex,con,int,wis,cha,save_prof_1,save_prof_2,installed_systems,core_system_id,frame_specs",
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
            }))
            .filter(
              (x: any) => typeof x.systemId === "string" && isSystemSlot(x.slot),
            )
            .map((x: any) => ({ systemId: x.systemId, slot: x.slot }));
          setInstalledSystems(cleaned);
        } else {
          setInstalledSystems([]);
        }
      } else {
        setShellName("");
        setStats(DEFAULT_STATS);
        setSaveProfs([]);
        setCoreSystemId(null);
        setFrameSpecIds([]);
        setInstalledSystems([]);
      }

      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  // ---------- Save ----------
  const save = async () => {
    setSaving(true);
    setError(null);
    setSavedAt(null);

    const payload = {
      user_id: userId,
      shell_name: shellName.trim(),
      ...stats,
      save_prof_1: saveProfs[0] ?? null,
      save_prof_2: saveProfs[1] ?? null,

      core_system_id: coreSystemId,
      frame_specs: frameSpecIds.slice(0, 4),

      installed_systems: installedSystems,
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

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Shell Configuration
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure attributes, derived systems, proficiencies, frame specs,
            and installed systems.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={loading || saving}>
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
              <div className="text-3xl font-semibold tabular-nums">
                {generation}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {STAT_DEFS.map(({ key, short }) => (
                <div
                  key={key}
                  className="rounded-lg border bg-background/20 px-3 py-2"
                >
                  <div className="text-xs text-muted-foreground">{short}</div>
                  <div className="mt-1 font-medium tabular-nums">
                    {fmtSigned(invested[key])}
                  </div>
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

      {/* Derived Systems */}
      <Card>
        <CardHeader>
          <CardTitle>Derived Systems</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-background/20 p-4">
              <div className="text-sm font-semibold">Auxiliary Stats</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <AuxTile
                  title="Fort"
                  value={fort}
                  detail="Contrib: STR + CON + CHA (per 3)"
                />
                <AuxTile
                  title="Agility"
                  value={agility}
                  detail="Contrib: 2×DEX + WIS (per 3)"
                />
                <AuxTile
                  title="Techno"
                  value={techno}
                  detail="Contrib: INT + WIS + CHA (per 3)"
                />
                <AuxTile
                  title="Internal"
                  value={internal}
                  detail="Contrib: STR + CON + INT (per 3)"
                />
              </div>
            </div>

            <div className="rounded-lg border bg-background/20 p-4">
              <div className="text-sm font-semibold">Tertiary Bonuses</div>
              <div className="mt-3 grid gap-2">
                <Row
                  label="Damage Threshold"
                  value={fmtSigned(damageThresholdBonus)}
                />
                <Row label="Spares" value={fmtSigned(sparesBonus)} />
                <Row label="AC" value={fmtSigned(acBonus)} />
                <Row
                  label="Movement Speed"
                  value={
                    moveSpeedBonusFt === 0 ? "+0 ft" : `+${moveSpeedBonusFt} ft`
                  }
                />
                <Row label="Save DC" value={fmtSigned(saveDCBonus)} />
                <Row label="Saving Throws" value={fmtSigned(savingThrowsBonus)} />
                <Row
                  label="System Capacity"
                  value={fmtSigned(systemCapacityBonus)}
                />
                <Row label="Buffer Size" value={fmtSigned(bufferSizeBonus)} />
                <Row
                  label="Buffer Duration"
                  value={fmtSigned(bufferDurationBonus)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proficiencies & Sensors */}
      <Card>
        <CardHeader>
          <CardTitle>Proficiencies & Sensors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border bg-background/20 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Saving Throws</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Choose exactly two save proficiencies. Proficiency bonus is{" "}
                    {fmtSigned(PROF_BONUS)}.
                  </div>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  Selected: {saveProfs.length}/2
                </div>
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
                          disabled={loading || disableCheck}
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

              {saveProfs.length !== 2 && (
                <div className="mt-3 text-xs text-muted-foreground">
                  You must select {2 - saveProfs.length} more proficiency
                  {2 - saveProfs.length === 1 ? "" : "ies"}.
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-background/20 p-4">
              <div className="text-sm font-semibold">Skills</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Shells are proficient in the following skills. Proficiency bonus
                is {fmtSigned(PROF_BONUS)}.
              </div>

              <div className="mt-4 grid gap-2">
                <Row
                  label="Athletics (STR)"
                  value={fmtSigned(skillBonus("str"))}
                />
                <Row
                  label="Acrobatics (DEX)"
                  value={fmtSigned(skillBonus("dex"))}
                />
                <Row
                  label="Perception (WIS)"
                  value={fmtSigned(skillBonus("wis"))}
                />
                <Row
                  label="Stealth (DEX)"
                  value={fmtSigned(skillBonus("dex"))}
                />
              </div>

              <div className="mt-6">
                <div className="text-sm font-semibold">Sensors</div>
                <div className="mt-2 flex items-center justify-between rounded-md border bg-card/40 px-3 py-2">
                  <div>Range</div>
                  <div className="font-medium tabular-nums">
                    {sensorsRangeFt} ft
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-muted-foreground">
            Saving throws use D&D-style ability modifiers. Listed skills are
            always proficient.
          </div>
        </CardContent>
      </Card>

      {/* Frame Specs (goes right above Systems) */}
      <Card>
        <CardHeader>
          <CardTitle>Frame Specs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border bg-background/20 p-3">
              <div>
                <div className="text-sm font-semibold">
                  Select 4 Frame Specs
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Frame Specs are persistent modifiers; choose four.
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground tabular-nums">
                  Selected: {frameSpecIds.length}/4
                </div>
                <Button
                  variant="outline"
                  onClick={() => setFrameSpecsOpen(true)}
                  disabled={loading}
                >
                  Choose Specs
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-background/20 p-4">
              <div className="text-sm font-semibold">Selected</div>
              <div className="mt-2 grid gap-2">
                {selectedFrameSpecs.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No frame specs selected yet.
                  </div>
                ) : (
                  selectedFrameSpecs.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-md border bg-card/40 px-3 py-2"
                    >
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {s.description}
                      </div>
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
                  Per-site cap: {PER_SLOT_CAP}. Total cap: {TOTAL_CAP} (19 +
                  System Capacity).
                </div>
                <div className="text-sm font-medium tabular-nums">
                  Total Installed Cost: {getTotalCost()}/{TOTAL_CAP}
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <SectionButton
                title="Core"
                subtitle={coreSystemName ? coreSystemName : "Select Core System"}
                onClick={() => setCoreModalOpen(true)}
                disabled={loading}
              />
              <SectionButton
                title="Hull"
                subtitle={`${getSlotCost("hull")}/${PER_SLOT_CAP}`}
                onClick={() => {
                  setCatalogueDefaultSlot("hull");
                  setCatalogueOpen(true);
                }}
                disabled={loading}
              />
              <SectionButton
                title="Left Arm"
                subtitle={`${getSlotCost("left_arm")}/${PER_SLOT_CAP}`}
                onClick={() => {
                  setCatalogueDefaultSlot("left_arm");
                  setCatalogueOpen(true);
                }}
                disabled={loading}
              />
              <SectionButton
                title="Right Arm"
                subtitle={`${getSlotCost("right_arm")}/${PER_SLOT_CAP}`}
                onClick={() => {
                  setCatalogueDefaultSlot("right_arm");
                  setCatalogueOpen(true);
                }}
                disabled={loading}
              />
              <SectionButton
                title="Legs"
                subtitle={`${getSlotCost("legs")}/${PER_SLOT_CAP}`}
                onClick={() => {
                  setCatalogueDefaultSlot("legs");
                  setCatalogueOpen(true);
                }}
                disabled={loading}
              />
              <SectionButton
                title="Back"
                subtitle={`${getSlotCost("back")}/${PER_SLOT_CAP}`}
                onClick={() => {
                  setCatalogueDefaultSlot("back");
                  setCatalogueOpen(true);
                }}
                disabled={loading}
              />
            </div>

            {/* Core modal */}
            <CoreSystemModal
              open={coreModalOpen}
              onClose={() => setCoreModalOpen(false)}
              coreSystems={CORE_SYSTEMS}
              selectedCoreSystemId={coreSystemId}
              onSelect={(id) => setCoreSystemId(id)}
              onClear={() => setCoreSystemId(null)}
            />

            {/* Installed list */}
            <div className="rounded-lg border bg-background/20 p-4">
              <div className="text-sm font-semibold">Installed Systems</div>
              <div className="mt-2 grid gap-2">
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

                    return (
                      <div
                        key={`${inst.systemId}:${inst.slot}`}
                        className="rounded-md border bg-card/40 px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-medium">{name}</div>
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
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeSystem(inst.systemId)}
                            disabled={loading}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Catalogue modal */}
            <SystemCatalogueModal
              open={catalogueOpen}
              onClose={() => setCatalogueOpen(false)}
              systems={SYSTEMS}
              defaultSlot={catalogueDefaultSlot}
              installed={installedSystems}
              perSlotCap={PER_SLOT_CAP}
              totalCap={TOTAL_CAP}
              getSystemCost={getSystemCost}
              getSlotCost={getSlotCost}
              getTotalCost={getTotalCost}
              onInstall={(systemId, slot) => installSystem(systemId, slot)}
            />
          </div>
        </CardContent>
      </Card>
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

function AuxTile(props: { title: string; value: number; detail: string }) {
  return (
    <div className="rounded-md border bg-card/40 p-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">{props.title}</div>
        <div className="font-semibold tabular-nums">{props.value}</div>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{props.detail}</div>
    </div>
  );
}

function SectionButton(props: {
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={[
        "rounded-lg border px-4 py-3 text-left transition-colors",
        "bg-background/20 hover:bg-accent hover:text-accent-foreground",
        props.disabled
          ? "cursor-not-allowed opacity-60 hover:bg-background/20"
          : "",
      ].join(" ")}
    >
      <div className="text-sm font-semibold">{props.title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{props.subtitle}</div>
    </button>
  );
}
