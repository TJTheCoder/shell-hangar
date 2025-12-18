"use client";

import { useMemo } from "react";
import type { CoreSystemDef } from "@/lib/systems/core-systems";
import { Button } from "@/components/ui/button";

export function CoreSystemModal(props: {
  open: boolean;
  onClose: () => void;
  coreSystems: CoreSystemDef[];
  selectedCoreSystemId: string | null;
  onSelect: (coreSystemId: string) => void;
  onClear: () => void;
}) {
  const { open, onClose, coreSystems, selectedCoreSystemId, onSelect, onClear } =
    props;

  const selected = useMemo(
    () => coreSystems.find((c) => c.id === selectedCoreSystemId) ?? null,
    [coreSystems, selectedCoreSystemId],
  );

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
            <div className="text-lg font-semibold">Core Systems</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Exactly one Core System may be installed on the Core. No other
              systems may be installed on the Core.
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {selected && (
            <div className="rounded-md border bg-background/20 p-3">
              <div className="text-sm font-semibold">Currently Installed</div>
              <div className="mt-1 text-sm">{selected.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {selected.description}
              </div>
              <div className="mt-3">
                <Button variant="outline" onClick={onClear}>
                  Remove Core System
                </Button>
              </div>
            </div>
          )}

          {coreSystems.map((c) => {
            const active = c.id === selectedCoreSystemId;
            return (
              <div key={c.id} className="rounded-lg border bg-background/20 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold">{c.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {c.description}
                    </div>
                  </div>
                  <Button
                    disabled={active}
                    onClick={() => onSelect(c.id)}
                    variant={active ? "outline" : "default"}
                  >
                    {active ? "Installed" : "Install"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          Note: Any “advantage” or action-economy effects are rules text for now
          and can be made mechanical later.
        </div>
      </div>
    </div>
  );
}
