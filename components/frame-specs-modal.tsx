"use client";

import { useMemo, useState } from "react";
import type { FrameSpecDef } from "@/lib/frame-specs/frame-specs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

function sortedTags(tags?: string[]) {
  return (tags ?? []).slice().sort((a, b) => a.localeCompare(b));
}

export function FrameSpecsModal(props: {
  open: boolean;
  onClose: () => void;
  specs: FrameSpecDef[];
  selectedIds: string[];
  maxSelected: number; // 4
  onToggle: (id: string) => void;
}) {
  const { open, onClose, specs, selectedIds, maxSelected, onToggle } = props;
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return specs;
    return specs.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (Array.isArray((s as any).tags) &&
          ((s as any).tags as string[]).some((t) =>
            String(t).toLowerCase().includes(q),
          )),
    );
  }, [specs, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />

      <div className="absolute left-1/2 top-1/2 w-[min(920px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <div className="text-lg font-semibold">Frame Specs</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Select {maxSelected}. Selected: {selectedIds.length}/{maxSelected}
            </div>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mt-4">
          <Input
            placeholder="Search frame specs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="mt-4 max-h-[55vh] overflow-auto pr-1">
          <div className="grid gap-3">
            {filtered.map((s) => {
              const checked = selectedSet.has(s.id);
              const disableNew = !checked && selectedIds.length >= maxSelected;

              const tags = Array.isArray((s as any).tags)
                ? sortedTags((s as any).tags as string[])
                : [];

              return (
                <div
                  key={s.id}
                  className="rounded-lg border bg-background/20 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`spec-${s.id}`}
                        checked={checked}
                        disabled={disableNew}
                        onCheckedChange={() => onToggle(s.id)}
                      />

                      <label
                        htmlFor={`spec-${s.id}`}
                        className={[
                          "cursor-pointer",
                          disableNew && !checked ? "opacity-60" : "",
                        ].join(" ")}
                      >
                        <div className="text-base font-semibold">{s.name}</div>

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

                        <div className="mt-2 text-sm text-muted-foreground">
                          {s.description}
                        </div>
                      </label>
                    </div>

                    {disableNew && (
                      <div className="text-xs text-muted-foreground text-right">
                        Max {maxSelected} selected
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="rounded-md border bg-background/20 p-4 text-sm text-muted-foreground">
                No frame specs match your search.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
