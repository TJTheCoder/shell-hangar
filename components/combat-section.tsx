// components/combat-section.tsx
import { BASE_ACTIONS, CombatAction, ActionType } from "@/lib/combat-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type SystemCondition = { state?: "disabled" | "destroyed" };

type InstalledSystemForCombat = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  condition?: SystemCondition;
};

type CombatActionWithMeta = CombatAction & {
  source?: "base" | "system";
  tags?: string[];
  isLightAp1?: boolean;
  complexityTurns?: number;
  systemId?: string;
};

const SECTION_LABELS: Record<ActionType, string> = {
  FIRST: "First",
  AP1: "AP: 1",
  AP2: "AP: 2",
  AP3: "AP: 3",
  REACTION: "Reaction",
};

function isActionTag(t: string) {
  return ["First", "AP: 1", "AP: 2", "AP: 3", "Reaction"].includes(t);
}

function tagToType(tag: string): ActionType {
  if (tag === "First") return "FIRST";
  if (tag === "Reaction") return "REACTION";
  if (tag === "AP: 1") return "AP1";
  if (tag === "AP: 2") return "AP2";
  return "AP3";
}

function sortedTags(tags: string[]) {
  return tags.slice().sort((a, b) => a.localeCompare(b));
}

function parseComplexity(tags: string[]) {
  for (const t of tags) {
    const m = /^Complexity:\s*(\d+)\s*$/i.exec(t.trim());
    if (m) return Math.max(0, Math.trunc(Number(m[1])));
  }
  return 0;
}

export function CombatSection({
  installedSystems,
  onUseSystem,
}: {
  installedSystems: InstalledSystemForCombat[];
  onUseSystem?: (systemId: string, turns: number) => void;
}) {
  const systemActions: CombatActionWithMeta[] = installedSystems
    .filter(
      (s) =>
        !s.condition ||
        (s.condition.state !== "disabled" && s.condition.state !== "destroyed"),
    )
    .flatMap((s) => {
      const tags = sortedTags(s.tags ?? []);
      const actionTags = tags.filter(isActionTag);
      const isLight = tags.includes("Light");
      const complexityTurns = parseComplexity(tags);

      return actionTags.map((tag) => ({
        id: `${s.id}-${tag}`,
        name: s.name,
        description: s.description,
        type: tagToType(tag),
        source: "system",
        tags,
        isLightAp1: tag === "AP: 1" && isLight,
        complexityTurns,
        systemId: s.id,
      }));
    });

  const baseActions: CombatActionWithMeta[] = BASE_ACTIONS.map((a) => ({
    ...a,
    source: "base",
  }));

  const allActions: CombatActionWithMeta[] = [...baseActions, ...systemActions];

  const firstActions = allActions.filter((a) => a.type === "FIRST");

  const lightAp1Actions = allActions.filter(
    (a) => a.source === "system" && a.isLightAp1,
  );

  const ap1Actions = allActions.filter(
    (a) => a.type === "AP1" && !(a.source === "system" && a.isLightAp1),
  );

  const ap2Actions = allActions.filter((a) => a.type === "AP2");
  const ap3Actions = allActions.filter((a) => a.type === "AP3");
  const reactionActions = allActions.filter((a) => a.type === "REACTION");

  const renderActionCard = (a: CombatActionWithMeta) => {
    const showUse =
      a.source === "system" &&
      (a.complexityTurns ?? 0) > 0 &&
      !!a.systemId &&
      !!onUseSystem;

    return (
      <div key={a.id} className="rounded-lg border p-4 bg-card">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-medium">{a.name}</h4>

          {showUse && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUseSystem!(a.systemId!, a.complexityTurns!)}
              title={`Use (disables for ${a.complexityTurns} turns)`}
            >
              Use
            </Button>
          )}
        </div>

        <p className="text-sm text-muted-foreground mt-1">{a.description}</p>

        {/* Show ALL tags for system-derived actions */}
        {a.source === "system" && a.tags && a.tags.length > 0 && (
          <div className="mt-2 flex gap-2 flex-wrap">
            {a.tags.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  };

  // IMPORTANT: remove the top margin here to eliminate the blank gap under your CardTitle
  return (
    <section className="space-y-8">
      {firstActions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">{SECTION_LABELS.FIRST}</h3>
          <div className="space-y-3">{firstActions.map(renderActionCard)}</div>
        </div>
      )}

      {lightAp1Actions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">AP: 1 (Light)</h3>
          <div className="space-y-3">
            {lightAp1Actions.map(renderActionCard)}
          </div>
        </div>
      )}

      {ap1Actions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">{SECTION_LABELS.AP1}</h3>
          <div className="space-y-3">{ap1Actions.map(renderActionCard)}</div>
        </div>
      )}

      {ap2Actions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">{SECTION_LABELS.AP2}</h3>
          <div className="space-y-3">{ap2Actions.map(renderActionCard)}</div>
        </div>
      )}

      {ap3Actions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">{SECTION_LABELS.AP3}</h3>
          <div className="space-y-3">{ap3Actions.map(renderActionCard)}</div>
        </div>
      )}

      {reactionActions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">
            {SECTION_LABELS.REACTION}
          </h3>
          <div className="space-y-3">
            {reactionActions.map(renderActionCard)}
          </div>
        </div>
      )}
    </section>
  );
}
