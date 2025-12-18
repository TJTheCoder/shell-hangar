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
      "You have advantage on all attacks, checks, and saving throws. In addition, you can Dash as a first action.",
  },
];
