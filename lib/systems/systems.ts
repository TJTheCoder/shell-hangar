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
      "You can either throw a smoke grenade w/ range 50 ft. and 20 ft. radius or plant a smoke mine w/ a 30 ft. detonation radius. You can specify specific creatures that trigger or don't trigger the mine when planting it. The smoke creates an area of heavy obscurement until the end of your next turn or until dispersed by a strong wind.",
  },
  {
    id: "corrosive-charges",
    name: "Corrosive Charges",
    cost: 2,
    tags: ["AP: 1", "Complexity: 3"],
    description:
      "You can either throw an acid grenade that deals 6d6 acid damage w/ range 50 ft. and 10 ft. radius or plant an acid mine that deals 12d6 acid damage w/ a 10 ft. detonation radius. You can specify specific creatures that trigger or don't trigger the mine when planting it. All creatures subject to damage must make a Dexterity saving throw. On a success, they take half damage.",
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
    cost: 2,
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
      "You plant a simple tracking bug on a target creature within range of Sensors. While the tracking bug is active, you always know the target's exact location. The target must make an Intelligence saving throw, and the creature can figure out how to fool/disable the bug with a successful Intelligence check using a bonus action/1 AP. Otherwise, the tracking bug lasts in perpetuity.",
  },
  {
    id: "actuator-spike",
    name: "Actuator Spike",
    cost: 2,
    tags: ["AP: 2", "Tech", "Bypasses Resistance"],
    description:
      "You cripple the motor function of a creature within 10 ft. by flooding them with corrupted noise. The target takes 6d6 psychic damage immediately and at the end of each of their turns, and loses all movement speed while the spike is active. The target must make an Constitution saving throw, and the creature can attempt regain control of its body and remove the spike with a successful Constitution saving throw using an action/2 AP. Otherwise, the spike lasts in perpetuity. You can only have one actuator spike active at a time.",
  },
  {
    id: "special-ammo-case",
    name: "Special Ammo Case",
    cost: 1,
    tags: ["First", "Complexity: 1"],
    description:
      "You grant your next attack with a Medium ranged weapon Blizzard, Sunburst, or Magnetic rounds. Blizzard rounds turn the damage into cold damage and push the target back 10 ft., Sunburst rounds turn the damage into radiant damage and cause all creatures within 10 ft. of your targets to automatically take 6 radiant damage that bypasses resistances, and Magnetic rounds turn the damage into piercing damage an grant the weapon Arcing. Regardless of a hit or miss, the rounds are consumed. The area-of-effect of Sunburst rounds applies even if you miss.",
  },
  {
    id: "linear-accelerator",
    name: "Linear Accelerator",
    cost: 3,
    tags: ["First"],
    description:
      "You increase your movement speed by 20 ft. and push creatures back an additional 20 ft. when you attack or shove them. These effects last until the start of your next turn. However, you can now only move in a straight line unless you collide with a hostile creature or obstruction, at which point you can change direction. You take 1 instability.",
  },
  {
    id: "battering-ram",
    name: "Battering Ram",
    cost: 2,
    description:
      "You deal 12 bludgeoning damage when you successfully shove a creature and 60 bludgeoning damage that bypasses resistances when you successfully shove an object/structure. This damage applies even if the objects/structure isn't or can't be moved.",
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
