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
];
