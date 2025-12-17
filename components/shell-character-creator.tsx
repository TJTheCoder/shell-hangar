"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

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

export function ShellCharacterCreator({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);

  const [shellName, setShellName] = useState("");
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);

  // NEW: two saving throw proficiencies (persisted)
  const [saveProfs, setSaveProfs] = useState<AbilityKey[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Load existing character (if any)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSavedAt(null);

      const { data, error } = await supabase
        .from("characters")
        .select("shell_name,str,dex,con,int,wis,cha,save_prof_1,save_prof_2")
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
        const p1 = data.save_prof_1 as AbilityKey | null;
        const p2 = data.save_prof_2 as AbilityKey | null;

        if (p1 && STAT_DEFS.some((s) => s.key === p1)) loadedProfs.push(p1);
        if (p2 && STAT_DEFS.some((s) => s.key === p2) && p2 !== p1)
          loadedProfs.push(p2);

        setSaveProfs(loadedProfs.slice(0, 2));
      } else {
        setShellName("");
        setStats(DEFAULT_STATS);
        setSaveProfs([]);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const setStat = (key: AbilityKey, value: number) => {
    setStats((prev) => ({
      ...prev,
      [key]: clamp(value, 8, 30),
    }));
  };

  const toggleSaveProf = (key: AbilityKey) => {
    setSaveProfs((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 2) return prev; // hard cap
      return [...prev, key];
    });
  };

  // ----- Derived values -----
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

  // Saving throws (D&D mod + optional proficiency)
  const saveBonus = (key: AbilityKey) =>
    abilityMod(stats[key]) + (saveProfs.includes(key) ? PROF_BONUS : 0);

  // Skills (always proficient): Athletics (STR), Acrobatics (DEX), Perception (WIS), Stealth (DEX)
  const skillBonus = (key: AbilityKey) => abilityMod(stats[key]) + PROF_BONUS;

  const sensorsRangeFt = 100;

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
            Name your shell and allocate attributes. Generation tracks total invested points.
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

      {/* Primary attributes */}
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

      {/* Derived Systems (Aux + Tertiary) */}
      <Card>
        <CardHeader>
          <CardTitle>Derived Systems</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border bg-background/20 p-4">
              <div className="text-sm font-semibold">Auxiliary Stats</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border bg-card/40 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Fort</div>
                    <div className="font-semibold tabular-nums">{fort}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Contrib: STR + CON + CHA (per 3)
                  </div>
                </div>

                <div className="rounded-md border bg-card/40 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Agility</div>
                    <div className="font-semibold tabular-nums">{agility}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Contrib: 2×DEX + WIS (per 3)
                  </div>
                </div>

                <div className="rounded-md border bg-card/40 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Techno</div>
                    <div className="font-semibold tabular-nums">{techno}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Contrib: INT + WIS + CHA (per 3)
                  </div>
                </div>

                <div className="rounded-md border bg-card/40 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Internal</div>
                    <div className="font-semibold tabular-nums">{internal}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Contrib: STR + CON + INT (per 3)
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-background/20 p-4">
              <div className="text-sm font-semibold">Tertiary Bonuses</div>
              <div className="mt-3 grid gap-2">
                <Row label="Damage Threshold" value={fmtSigned(damageThresholdBonus)} />
                <Row label="Spares" value={fmtSigned(sparesBonus)} />
                <Row label="AC" value={fmtSigned(acBonus)} />
                <Row
                  label="Movement Speed"
                  value={moveSpeedBonusFt === 0 ? "+0 ft" : `+${moveSpeedBonusFt} ft`}
                />
                <Row label="Save DC" value={fmtSigned(saveDCBonus)} />
                <Row label="Saving Throws" value={fmtSigned(savingThrowsBonus)} />
                <Row label="System Capacity" value={fmtSigned(systemCapacityBonus)} />
                <Row label="Buffer Size" value={fmtSigned(bufferSizeBonus)} />
                <Row label="Buffer Duration" value={fmtSigned(bufferDurationBonus)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NEW: Saving Throws / Skills / Sensors */}
      <Card>
        <CardHeader>
          <CardTitle>Proficiencies & Sensors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Saving throws */}
            <div className="rounded-lg border bg-background/20 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Saving Throws</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Choose exactly two save proficiencies. Proficiency bonus is {fmtSigned(PROF_BONUS)}.
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
                          {label} <span className="text-xs text-muted-foreground">({short})</span>
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

              {saveProfs.length !== 2 && (
                <div className="mt-3 text-xs text-muted-foreground">
                  You must select {2 - saveProfs.length} more proficiency
                  {2 - saveProfs.length === 1 ? "" : "ies"}.
                </div>
              )}
            </div>

            {/* Skills + Sensors */}
            <div className="rounded-lg border bg-background/20 p-4">
              <div className="text-sm font-semibold">Skills</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Shells are proficient in the following skills. Proficiency bonus is {fmtSigned(PROF_BONUS)}.
              </div>

              <div className="mt-4 grid gap-2">
                <Row label="Athletics (STR)" value={fmtSigned(skillBonus("str"))} />
                <Row label="Acrobatics (DEX)" value={fmtSigned(skillBonus("dex"))} />
                <Row label="Perception (WIS)" value={fmtSigned(skillBonus("wis"))} />
                <Row label="Stealth (DEX)" value={fmtSigned(skillBonus("dex"))} />
              </div>

              <div className="mt-6">
                <div className="text-sm font-semibold">Sensors</div>
                <div className="mt-2 flex items-center justify-between rounded-md border bg-card/40 px-3 py-2">
                  <div>Range</div>
                  <div className="font-medium tabular-nums">{sensorsRangeFt} ft</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-muted-foreground">
            Saving throws use D&D-style ability modifiers. Skill proficiencies listed above are always active.
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
