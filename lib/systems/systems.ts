export type SystemSlot = "hull" | "left_arm" | "right_arm" | "legs" | "back";

export type SystemDef = {
  id: string;
  name: string;
  cost: number;
  description: string;
  tags?: string[];
};

export const SYSTEMS: SystemDef[] = [
  //general systems
  {
    id: "backup-flight-system",
    name: "Backup Flight System",
    cost: 3,
    description:
      "You can convert any amount of your walking speed to flying speed at will.",
  },

  //light weapons
  {
    id: "\"slashy\"",
    name: "\"Slashy\"",
    cost: 1,
    tags: ["AP: 1", "Homing", "Light"],
    description:
      "A frenzied, machete-swinging drone; 2d6 slashing w/ 100 ft. range.",
  },

  //medium weapons
  {
    id: "assault-rifle",
    name: "Assault Rifle",
    cost: 2,
    tags: ["AP: 1", "Minimum: 12", "Medium"],
    description:
      "A standard and reliable shell-class AR; 6d6 piercing w/ 100 ft. range.",
  },

  //heavy weapons
  {
    id: "tranquilizer-rifle",
    name: "Tranquilizer Rifle",
    cost: 3,
    tags: ["AP: 1", "Complexity: 1", "Heavy", "Accurate", "Artillery", "Bypasses Resistance"],
    description:
      "A rifle equipped with potent, sedative darts; 12d6 poison w/ 200 ft. range. Creatures reduced to 0 hit points by this are knocked out instead of killed.",
  },
];
