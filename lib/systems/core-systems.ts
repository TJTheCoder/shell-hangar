export type CoreSystemDef = {
  id: string;
  name: string;
  description: string;
  tags?: string[]; // optional (keep for future consistency)
};

export const CORE_SYSTEMS: CoreSystemDef[] = [
  {
    id: "apex-drive",
    name: "Apex Drive",
    description:
      "You have advantage on all attacks, checks, and saving throws. In addition, you can dash as a first action.",
  },
  {
    id: "brwnn-copilot",
    name: "BRWN-N Copilot",
    description:
      "Your ranged weapons now have a reach of 20 ft. for the purposes of opportunity attacks. In addition, you can opportunity attack an additional time each round, and creatures hit with your opportunity attacks lose all their movement speed.",
  },
  {
    id: "ghost-cloak",
    name: "Ghost Cloak",
    description:
      "You are Invisible.",
  },
  {
    id: "momentary-warp-engine",
    name: "Momentary Warp Engine",
    description:
      "You teleport when you move and can split up movement into multiple teleports. You can try to teleport to places you can't see, but you take 1 instability and lose the spent movement if the space is not empty.",
  },
  {
    id: "fortress-mode",
    name: "Fortress Mode",
    description:
      "You lose all movement speed, always have 3/4ths cover (even if you are in the open), cannot be knocked prone or moved involuntarily, completely negate all damage when you guard, and unfold two defensive walls from your Core. These walls are 20 ft. long, 10 ft. wide, and 10 ft. tall lines, are immune to all damage, and can each extend in different directions. Any creature that gains 3/4ths cover from either the walls or you cannot be knocked prone or moved involuntarily and takes half damage from area-of-effects.",
  },
];
