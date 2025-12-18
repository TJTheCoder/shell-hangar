export type SystemSlot = "hull" | "left_arm" | "right_arm" | "legs" | "back";

export type SystemDef = {
  id: string;
  name: string;
  cost: number;
  description: string;
  tags?: string[]; // multiple or none
};

export const SYSTEMS: SystemDef[] = [
  {
    id: "backup-flight-system",
    name: "Backup Flight System",
    cost: 3,
    description:
      "You can convert any amount of your walking speed to flying speed at will.",
  },
  {
    id: "\"slashy\"",
    name: "\"Slashy\"",
    cost: 1,
    tags: ["AP: 1", "Homing", "Light"], // these will be sorted alphabetically in UI
    description:
      "A frenzied, machete-swinging drone; 2d6 slashing w/i 100 ft.",
  },
];
