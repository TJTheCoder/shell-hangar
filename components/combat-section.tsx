import { BASE_ACTIONS, CombatAction, ActionType } from "@/lib/combat-actions";
import { Badge } from "@/components/ui/badge";

const SECTION_LABELS: Record<ActionType, string> = {
  FIRST: "First",
  AP1: "AP: 1",
  AP2: "AP: 2",
  AP3: "AP: 3",
  REACTION: "Reaction",
};

export function CombatSection({
  installedSystems,
}: {
  installedSystems: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    condition?: { state?: "disabled" | "destroyed" };
  }>;
}) {
  const systemActions: CombatAction[] = installedSystems
    .filter(
      (s) =>
        !s.condition ||
        (s.condition.state !== "disabled" &&
          s.condition.state !== "destroyed"),
    )
    .flatMap((s) => {
      const actionTags = s.tags.filter((t) =>
        ["First", "AP: 1", "AP: 2", "AP: 3", "Reaction"].includes(t),
      );

      return actionTags.map((tag) => ({
        id: `${s.id}-${tag}`,
        name: s.name,
        description: s.description,
        type:
          tag === "First"
            ? "FIRST"
            : tag === "Reaction"
              ? "REACTION"
              : tag === "AP: 1"
                ? "AP1"
                : tag === "AP: 2"
                  ? "AP2"
                  : "AP3",
      }));
    });

  const allActions = [...BASE_ACTIONS, ...systemActions];

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold mb-6">Combat</h2>

      {(
        ["FIRST", "AP1", "AP2", "AP3", "REACTION"] as ActionType[]
      ).map((type) => {
        const actions = allActions.filter((a) => a.type === type);
        if (actions.length === 0) return null;

        return (
          <div key={type} className="mb-8">
            <h3 className="text-lg font-semibold mb-3">
              {SECTION_LABELS[type]}
            </h3>

            <div className="space-y-3">
              {actions.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border p-4 bg-card"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{a.name}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {a.description}
                  </p>

                  {"tags" in a && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {(a as any).tags?.sort().map((t: string) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
