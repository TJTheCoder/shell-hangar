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
  {
    id: "rc-receiver",
    name: "RC Receiver",
    cost: 2,
    tags: ["First"],
    description:
      "You, the pilot, remotely control the shell as long as it is within 500 ft. and communication is unobstructed.",
  },
  {
    id: "all-terrain-module",
    name: "All-Terrain Module",
    cost: 1,
    description:
      "You can move through space and standard fluids without any movement or combat penalties.",
  },
  {
    id: "smoke-charges",
    name: "Smoke Charges",
    cost: 2,
    tags: ["AP: 1", "Complexity: 3"],
    description:
      "You can either throw a smoke grenade w/ range 50 ft. and 20 ft. radius or plant a smoke mine w/ a 30 ft. detonation radius. You can specify specific creatures that trigger or doesn't trigger the mine when planting it. The smoke creates an area of heavy obscurement until the end of your next turn or until dispersed by a strong wind.",
  },
  {
    id: "jump-jets",
    name: "Jump Jets",
    cost: 2,
    description:
      "When you dash, you can use the additional movement to fly. This does not count as true flying, as you begin falling at the end of your turn unless you can fly.",
  },
  {
    id: "mirage-projector",
    name: "Mirage Projector",
    cost: 1,
    tags: ["AP: 1", "Tech"],
    description:
      "You force a target creature within range of Sensors to percieve nothing when observing another creature of your choice within range of Sensors. The target percieves the second creature as Invisible until the end of the target's turn. The target must make an Intelligence saving throw.",
  },
  {
    id: "tracking-bug",
    name: "Tracking Bug",
    cost: 2,
    tags: ["AP: 1", "Tech"],
    description:
      "You plant a simple tracking bug on a target creature within range of Sensors. While the tracking bug is active, you always know the target's exact location. The target must make an Intelligence saving throw, and the creature can figure out how to fool/disable the bug with a successful Intelligence check using a bonus action/1 AP. Otherwise, the tracking bug lasts in perpetuity. The target must make an Intelligence saving throw.",
  },


  //light weapons
  {
    id: "\"slashy\"",
    name: "\"Slashy\"",
    cost: 1,
    tags: ["AP: 1", "Tech", "Light"],
    description:
      "A frenzied, machete-swinging drone; 3d6 slashing w/ 100 ft. range. The target must make a Dexterity saving throw.",
  },
  {
    id: "acid-blob-mortar",
    name: "Acid Blob Mortar",
    cost: 1,
    tags: ["AP: 1", "Light", "Complexity: 1"],
    description:
      "A cannon that launches big blobs of corrosive acid; 3d6+6 acid w/ 100 ft. range and 10 ft. radius.",
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
  {
    id: "photon-saber",
    name: "Photon Saber",
    cost: 2,
    tags: ["AP: 1", "Bypasses Resistance", "Medium"],
    description:
      "A sword whose blade is pure plasma; 3d6+18 radiant w/ 10 ft. reach.",
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
  {
    id: "sledgehammer",
    name: "Sledgehammer",
    cost: 3,
    tags: ["AP: 1", "Heavy"],
    description:
      "A top-heavy, shell-class warhammer; 12d6+6 bludgeoning w/ 10 ft. reach.",
  },
];
