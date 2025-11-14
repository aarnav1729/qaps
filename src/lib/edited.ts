export type EditedSnos = { mqp: number[]; visual: number[] };
export const isEdited = (
  kind: "mqp" | "visual",
  sno: number,
  edited?: EditedSnos
) =>
  !!edited && Array.isArray(edited[kind]) && edited[kind].includes(Number(sno));
