"use client";

import { useEffect, useMemo, useState } from "react";
import type { SystemDef, SystemSlot } from "@/lib/systems/systems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SLOT_LABELS: Record<SystemSlot, string> = {
  hull: "Hull",
  left_arm: "Left Arm",
  right_arm: "Right Arm",
  legs: "Legs",
  back: "Back",
};

export type InstalledSystem = {
  systemId: string;
  slot: SystemSlot;
};

function sortedTags(tags?: string[]) {
  return (tags ?? []).slice().sort((a, b) => a.localeCompare(b));
}

export function SystemCatalogueModal(props: {
  open: boolean;
  onClose: () => void;

  // catalogue
  systems: SystemDef[];

  // install context
  defaultSlot: SystemSlot;

  // current loadout
  installed: InstalledSystem[];

  // caps
  perSlotCap: number; // 6
  totalCap: number; // 19 + systemCapacityBonus

  // cost calculator helpers
  getSystemCost: (id: string) => number;
  getSlotCost: (slot: SystemSlot) => number;
  getTotalCost: () => number;

  // actions
  onInstall: (systemId: string, slot: SystemSlot) => void;
}) {
  const {
    open,
    onClose,
    systems,
    defaultSlot,
    installed,
    perSlotCap,
    totalCap,
    getSystemCost,
    getSlotCost,
    getTotalCost,
    onInstall,
  } = props;

  const [search, setSearch] = useState("");
  const [slot, setSlot] = useState<SystemSlot>(defaultSlot);

  // Keep install target aligned to the section that opened the modal
  useEffect(() => {
    if (open) setSlot(defaultSlot);
  }, [open, defaultSlot]);

  const installedSet = useMemo(
    () => new Set(installed.map((x) => x.systemId)),
    [installed],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return systems;

    return systems.filter((s) => {
      const tagBlob = (s.tags ?? []).join(" ").toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        tagBlob.includes(q)
      );
    });
  }, [systems, search]);

  if (!open) return null;

  const slotCost = getSlotCost(slot);
  const totalCost = getTotalCost();

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />

      {/* panel */}
      <div className="absolute left-1/2 top-1/2 w-[min(920px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <div className="text-lg font-semibold">System Catalogue</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Install rules: max {perSlotCap} per body part · max {totalCap}{" "}
              total (19 + System Capacity)
            </div>
          </div>

          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Input
              placeholder="Search systems… (name, description, tags)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border bg-background/30 px-3 py-2">
            <div className="text-sm">Install to</div>
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm"
              value={slot}
              onChange={(e) => setSlot(e.target.value as SystemSlot)}
            >
              <option value="hull">Hull</option>
              <option value="left_arm">Left Arm</option>
              <option value="right_arm">Right Arm</option>
              <option value="legs">Legs</option>
              <option value="back">Back</option>
            </select>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-md border bg-background/20 px-3 py-2">
            <div className="text-xs text-muted-foreground">Target slot cost</div>
            <div className="mt-1 font-medium tabular-nums">
              {SLOT_LABELS[slot]}: {slotCost}/{perSlotCap}
            </div>
          </div>
          <div className="rounded-md border bg-background/20 px-3 py-2">
            <div className="text-xs text-muted-foreground">Total cost</div>
            <div className="mt-1 font-medium tabular-nums">
              {totalCost}/{totalCap}
            </div>
          </div>
          <div className="rounded-md border bg-background/20 px-3 py-2">
            <div className="text-xs text-muted-foreground">Uniqueness</div>
            <div className="mt-1 font-medium">One of each system</div>
          </div>
        </div>

        <div className="mt-4 max-h-[55vh] overflow-auto pr-1">
          <div className="grid gap-3">
            {filtered.map((sys) => {
              const alreadyInstalled = installedSet.has(sys.id);
              const cost = sys.cost;

              const wouldSlot = slotCost + cost;
              const wouldTotal = totalCost + cost;

              const slotOver = wouldSlot > perSlotCap;
              const totalOver = wouldTotal > totalCap;

              const disabled = alreadyInstalled || slotOver || totalOver;

              let reason: string | null = null;
              if (alreadyInstalled) reason = "Already installed (unique).";
              else if (slotOver)
                reason = `Exceeds ${SLOT_LABELS[slot]} cap (${perSlotCap}).`;
              else if (totalOver) reason = `Exceeds total cap (${totalCap}).`;

              const tags = sortedTags(sys.tags);

              return (
                <div
                  key={sys.id}
                  className="rounded-lg border bg-background/20 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold">{sys.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {sys.description}
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

                      <div className="mt-2 text-xs text-muted-foreground">
                        System Cost:{" "}
                        <span className="font-medium">{cost}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <Button
                        disabled={disabled}
                        onClick={() => onInstall(sys.id, slot)}
                      >
                        Install
                      </Button>
                      {reason && (
                        <div className="text-xs text-muted-foreground text-right">
                          {reason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="rounded-md border bg-background/20 p-4 text-sm text-muted-foreground">
                No systems match your search.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          Note: Core is special and managed separately.
        </div>
      </div>
    </div>
  );
}
