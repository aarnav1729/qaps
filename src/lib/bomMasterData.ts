import { BOM_COMPONENTS } from "@/data/components";
import {
  BOM_MASTER as STATIC_BOM_MASTER,
  type BomComponentOption as StaticBomComponentOption,
} from "@/data/bomMaster";

export interface BomMasterOption {
  model: string;
  subVendor?: string | null;
  spec?: string | null;
}

export interface BomMasterComponent {
  id: string;
  name: string;
  technology?: string | null;
  options: BomMasterOption[];
}

const STATIC_COMPONENTS: BomMasterComponent[] = [
  ...BOM_COMPONENTS.map((name) => ({
    id: name,
    name,
    options: (((STATIC_BOM_MASTER as Record<string, StaticBomComponentOption[]>)[
      name
    ] || []) as StaticBomComponentOption[]).map((option) => ({
      model: option.model,
      subVendor: option.subVendor ?? null,
      spec: option.spec ?? null,
    })),
  })),
  ...Object.keys(STATIC_BOM_MASTER)
    .filter((name) => !BOM_COMPONENTS.includes(name as (typeof BOM_COMPONENTS)[number]))
    .map((name) => ({
      id: name,
      name,
      options: (((STATIC_BOM_MASTER as Record<string, StaticBomComponentOption[]>)[
        name
      ] || []) as StaticBomComponentOption[]).map((option) => ({
        model: option.model,
        subVendor: option.subVendor ?? null,
        spec: option.spec ?? null,
      })),
    })),
];

export const getBomMasterComponents = (
  components?: BomMasterComponent[] | null
): BomMasterComponent[] =>
  Array.isArray(components) && components.length ? components : STATIC_COMPONENTS;

export const getBomComponentNames = (
  components?: BomMasterComponent[] | null
) => getBomMasterComponents(components).map((component) => component.name);

export const getBomOptionsFor = (
  components: BomMasterComponent[] | null | undefined,
  name: string
): readonly BomMasterOption[] => {
  const live = getBomMasterComponents(components).find(
    (component) => component.name === name
  );
  if (live) return live.options;
  return (
    (STATIC_BOM_MASTER as Record<string, StaticBomComponentOption[]>)[name] || []
  );
};
