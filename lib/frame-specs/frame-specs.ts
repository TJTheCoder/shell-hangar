export type FrameSpecDef = {
  id: string;
  name: string;
  description: string;
  tags?: string[]; // optional future
};

export const FRAME_SPECS: FrameSpecDef[] = [
  {
    id: "rapid-boot-sequence",
    name: "Rapid Boot Sequence",
    description:
      "On your first turn in an encounter, you gain 1 additional AP.",
  },
  {
    id: "generic-parts",
    name: "Generic Parts",
    description:
      "When you use repair a structure, you use 1 Spare instead of 2 Spares.",
  },
  {
    id: "winch-claw",
    name: "Winch Claw",
    description:
      "Your range for grappling is increased to 50 ft. When you first grapple a creature and there is a suitable path, you can choose to immediately be pulled anywhere within 10 ft. of them.",
  },
  {
    id: "gyroscopic-counterweight",
    name: "Gyroscopic Counterweight",
    description:
      "While grappling another creature, you have no penalties to your movement.",
  },
  {
    id: "heavy-frame",
    name: "Heavy Frame",
    description:
      "You cannot be pushed, pulled, knocked prone, or shoved by the physical efforts of smaller creatures.",
  },
  {
    id: "weather-plating",
    name: "Weather Plating",
    description:
      "You have resistance to fire, cold, lightning, thunder, and acid damage.",
  },
  {
    id: "gigantus",
    name: "Gigantus",
    description:
      "You are Gargantuan (4x4x4). In addition, you can grant adjacent creatures within 10 ft. 3/4ths cover, even if they are between you and an enemy.",
  },
  {
    id: "wasp-swarm",
    name: "W.A.S.P. Swarm",
    description:
      "Creatures of your choice that start their turn grappled by or within 10 ft. of you take 12 poison damage. They must also succeed on a Constitution saving throw or be Blinded until the end of their turn.",
  },
  {
    id: "regeneration",
    name: "Regeneration",
    description:
      "At the end of your turn, note if you have rolled any instabilities. If you haven't, you can instantly repair one disabled system/structure with a remaining timer of 1.",
  },
  {
    id: "refurbishable",
    name: "Refurbishable",
    description:
      "The amount of Spares used for repairs at a dedicated hangar or engineering bay is additionally demoted by one tier (4>2>1>0).",
  },
  {
    id: "camera-camouflage",
    name: "Camera Camouflage",
    description:
      "You become Invisible at the end of your turn if you haven't moved. This lasts until you move, take a reaction, or the start of your next turn.",
  },
  {
    id: "enhanced-scanner",
    name: "Enhanced Scanner",
    description:
      "When you mark a creature, the attack that consumes the mark bypasses resistances.",
  },
  {
    id: "pristine-code",
    name: "Pristine Code",
    description:
      "Creatures who have to make a saving throw against your tech abilities have disadvantage.",
  },
  {
    id: "quantum-exploit-suite",
    name: "Quantum Exploit Suite",
    description:
      "Creatures who have to make a saving throw against your tech abilities have disadvantage.",
  },
  {
    id: "countercode",
    name: "Countercode",
    tags: ["AP: 1", "Tech", "Reaction"],
    description:
      "You use a 1 AP Tech ability when affected by any spell/tech. Spells/tech that have their effects avoided do not qualify.",
  },
];
