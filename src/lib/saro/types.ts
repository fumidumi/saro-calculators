export type ObjectType = "private" | "other";
export type RoofType = "pitched" | "flat" | "mixed";
export type DrainType = "external" | "internal" | "mixed";
export type AutomationPlace = "outdoor" | "indoor";
export type PowerChoice = "auto" | "1ph" | "3ph";
export type CableChoice = "rooftop" | "resistive" | "compare";
export type SurfaceType =
  | "metal_drain"
  | "plastic_drain"
  | "metal_tile"
  | "seam_roof"
  | "soft_roof"
  | "unknown";

export interface ObjectStep {
  objectType: ObjectType;
  roofType: RoofType;
  drainType: DrainType;
  automationPlace: AutomationPlace;
  powerChoice: PowerChoice;
}

export interface ZonesStep {
  surfaceType: SurfaceType;
  gutter: { enabled: boolean; length: number; topExtraLine: boolean };
  hangingTray: { enabled: boolean; length: number; widthCm: number };
  downpipes: { enabled: boolean; quantity: number; height: number; hasFunnel: boolean };
  valleys: { enabled: boolean; length: number };
  dripEdge: { enabled: boolean; length: number };
  slopeEdge: { enabled: boolean; length: number; widthCm: number; stepCm: number };
}

export interface FastenerItem {
  zone: string;
  item: string;
  quantity: number;
  unit: string;
  note: string;
}

export interface ZoneResult {
  key: string;
  name: string;
  inputs: string;
  rule: string;
  length: number;
  power: number;
}
