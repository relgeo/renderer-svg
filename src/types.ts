import { ResolvedScene, TechnicalRole } from "relgeo-geometry";

export type RoleVisibilityOptions = {
  [K in TechnicalRole as `show${Capitalize<K>}`]?: boolean;
};
export interface RenderOptions extends RoleVisibilityOptions {
  padding?: number;
  showAnchors?: boolean;
  sheetId?: string;
  hairline?: boolean;
  hairlineWidth?: number | string;
  nonScalingStroke?: boolean;
  physicalMode?: boolean;
  pointShape?: "plus" | "circle";
  showLabels?: boolean;
  showBoundingBox?: boolean;
}

export interface Renderer<T> {
  render(scene: ResolvedScene, options?: RenderOptions): T;
}
