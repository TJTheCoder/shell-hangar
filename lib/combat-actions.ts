// lib/combat-actions.ts

export type ActionType = "FIRST" | "AP1" | "AP2" | "AP3" | "REACTION";

export interface CombatAction {
  id: string;
  name: string;
  type: ActionType;
  description: string;
}

export const BASE_ACTIONS: CombatAction[] = [
  {
    id: "enter-exit",
    name: "Enter/Exit",
    type: "FIRST",
    description:
      "You, the pilot, embark or disembark your shell.",
  },
  {
    id: "activate-protocol",
    name: "Activate Protocol",
    type: "FIRST",
    description:
      "You, the pilot, order the shell to autonomously operate under the Stay, Follow, Approach, or Retreat protocols. A protocol can only be activated while within range of Sensors, and is deactivated once the shell is operated manually in any way.",
  },
  {
    id: "surge",
    name: "Surge",
    type: "FIRST",
    description:
      "You overclock your core, allowing you to gain 1 additional AP this turn. You take 1 instability.",
  },
  {
    id: "manage-instabilities",
    name: "Manage Instabilities",
    type: "FIRST",
    description:
      "You manage your instability buffer, taking any amount of instabilities on it.",
  },
  {
    id: "dash",
    name: "Dash",
    type: "AP1",
    description:
      "You move an additional distance up to your Movement Speed.",
  },
  {
    id: "grapple",
    name: "Grapple",
    type: "AP1",
    description:
      "You attempt to grapple a target (the target makes a STR/DEX saving throw against 14 + your STR) within 10 ft. You must have at least one arm available.",
  },
  {
    id: "hide",
    name: "Hide",
    type: "AP1",
    description:
      "You attempt to hide (DC 15 Stealth check). You must be either Invisible or have line of sight obstructed to do so. If your hiding is successful, note the Stealth roll. This becomes your Hide DC. You are no longer Hidden if both of these conditions are falsified, you take any hostile actions, or do something that would reasonably reveal you.",
  },
  {
    id: "support",
    name: "Support",
    type: "AP1",
    description:
      "You aid a creature within range of Sensors, and either stabilize them or allow them to gain advantage on a save or skill check involving something you are proficient in. This advantage can only be used once and expires at the end of your next turn.",
  },
  {
    id: "mark",
    name: "Mark",
    type: "AP1",
    description:
      "You scan and mark a specific creature within range of Sensors until the end of your next turn. When another creature makes an attack against them, you can choose to grant the attacker +5 to the attack roll. Once granted, the target is no longer marked.",
  },
  {
    id: "shove",
    name: "Shove",
    type: "AP1",
    description:
      "You attempt to shove a target (the target makes a STR/DEX saving throw against 14 + your STR). If the shoving is successful, you can either move them 10 ft. away or knock them prone. You must have at least one arm available.",
  },
  {
    id: "search",
    name: "Search",
    type: "AP1",
    description:
      "You attempt to locate a Hidden creature (Perception check vs. Hide DC). If your searching is successful, the target is no longer Hidden for you and can instantly be revealed to creatures of your choosing unless communication is obstructed.",
  },
  {
    id: "ready",
    name: "Ready",
    type: "AP1",
    description:
      "You prepare an action with AP cost 1 and specify a trigger. Whenever that trigger is met, you can instantaneously take a reaction execute the prepared action. You can also prepare actions with AP costs greater than 1, but the cost of this action increases to match the cost of the prepared action.",
  },
  {
    id: "self-destruct",
    name: "Self-Destruct",
    type: "AP1",
    description:
      "You initiate the self-destruct sequence, setting the countdown to either the end of your current turn or the end of your next turn. Once the countdown expires, the mech destructively explodes in a 20 ft. radius, dealing 12d6 thunder damage and 12d6 force damage to everyone who fails a Dexterity save. Creature that succeed take half damage. You can take this action again to disable the detonation sequence.",
  },
  {
    id: "disengage",
    name: "Disengage",
    type: "AP2",
    description:
      "You extricate yourself from a dangerous situation, and no longer trigger opportunity attacks of any kind when you move.",
  },
  {
    id: "desperate-attack",
    name: "Desperate Attack",
    type: "AP2",
    description:
      "You use anything and everything at your disposal to make a desperate attack against a target within 10 ft. of you. On a hit, they take 6d6 damage of a reasonable type. This attack has no structure requirements.",
  },
  {
    id: "repair",
    name: "Repair",
    type: "AP2",
    description:
      "You mend yourself using Spares, either using 1 Spare to restore a destroyed/disabled system, 2 Spares to restore a destroyed/disabled non-Core structure, or 4 Spares to restore a destroyed/disabled Core.",
  },
  {
    id: "gossamer-veil",
    name: "Gossamer Veil",
    type: "AP2",
    description:
      "You de-quantize the glox spool attached to your back, forcing a creature within 10 ft. to make a CHA save. On a failed save, a wave-particle domain envelops you and your target, rendering you both unable to interact with any other creature. The effect ends when your Back is disabled/destroyed, you end it at will, or when the veil itself is destroyed. The veil can be attacked when a third party uses an attack that directly targets either you or the trapped creature or when the target attacks any empty space around them. To destroy the veil, damage exceeding your Double Damage Threshold must be dealt in one instance of damage. The veil shares your vulnerabilities, resistances, and immunities.",
  },
  {
    id: "guard",
    name: "Guard",
    type: "REACTION",
    description:
      "You halve the total incoming damage of a single attack or area-of-effect.",
  },
  {
    id: "opportunity-attack-shell",
    name: "Opportunity Attack (Shell)",
    type: "REACTION",
    description:
      "You make an attack with a melee weapon that is at most Heavy against a creature who has entered, exited, or moved around within the spherical space carved out by that melee weapon's reach. If two Light weapons are eligible for an opportunity attack, you can use both of them.",
  },
];
