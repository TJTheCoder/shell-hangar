"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Stats = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
};

const STAT_DEFS: Array<{ key: keyof Stats; label: string }> = [
  { key: "str", label: "Strength" },
  { key: "dex", label: "Dexterity" },
  { key: "con", label: "Constitution" },
  { key: "int", label: "Intelligence" },
  { key: "wis", label: "Wisdom" },
  { key: "cha", label: "Charisma" },
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

export function ShellCharacterCreator({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);

  const [shellName, setShellName] = useState("");
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Load existing character (if any). If none, create defaults in UI.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSavedAt(null);

      const { data, error } = await supabase
        .from("characters")
        .select("shell_name,str,dex,con,int,wis,cha")
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
      } else {
        setShellName("");
        setStats(DEFAULT_STATS);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const setStat = (key: keyof Stats, value: number) => {
    setStats((prev) => ({
      ...prev,
      [key]: clamp(value, 8, 30),
    }));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSavedAt(null);

    const payload = {
      user_id: userId,
      shell_name: shellName.trim(),
      ...stats,
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
          <h1 className="text-2xl font-semibold tracking-tight">Shell Configuration</h1>
          <p className="text-sm text-muted-foreground">
            Name your shell and allocate core attributes (8–30).
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
              placeholder="e.g., HANGAR-07 “Kestrel”"
              value={shellName}
              onChange={(e) => setShellName(e.target.value)}
              disabled={loading}
              maxLength={64}
            />
          </div>
        </CardContent>
      </Card>

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
                    className="w-24 text-right"
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
    </div>
  );
}
