import { ResolvedObject, ResolvedScene, ResolvedTransform, TechnicalRole } from "@relgeo/geometry";

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

export type SVGRenderErrorCode =
  | "INVALID_RENDER_OPTIONS"
  | "MISSING_SHEET"
  | "MISSING_VIEW"
  | "MISSING_COMPOSITION_TARGET"
  | "UNSUPPORTED_RESOLVED_SHAPE";

export class SVGRenderError extends Error {
  readonly code: SVGRenderErrorCode;

  constructor(code: SVGRenderErrorCode, message: string) {
    super(message);
    this.name = "SVGRenderError";
    this.code = code;
  }
}

export type SVGSemanticErrorCode =
  | "INVALID_SEMANTIC_PROJECTION"
  | "INVALID_SEMANTIC_REPLAY";

/**
 * Stable public error for the renderer semantic boundary.
 *
 * Semantic projection/replay is consumed by parity tooling, so malformed
 * resolved scenes and snapshots must not leak an engine-specific Error. The
 * optional path identifies the semantic field that failed validation.
 */
export class SVGSemanticError extends Error {
  readonly code: SVGSemanticErrorCode;
  readonly path?: string;

  constructor(code: SVGSemanticErrorCode, message: string, path?: string) {
    super(`${code}: ${message}`);
    this.name = "SVGSemanticError";
    this.code = code;
    this.path = path;
  }
}

export interface SVGSemanticPoint {
  x: number;
  y: number;
}

export interface SVGSemanticSegment {
  type: "line" | "arc" | "quadratic" | "cubic";
  from: SVGSemanticPoint;
  to: SVGSemanticPoint;
  controlPoints?: SVGSemanticPoint[];
  radius?: number;
  sweep?: 0 | 1;
  largeArc?: 0 | 1;
}

export interface SVGSemanticRing {
  closed: true;
  segments: SVGSemanticSegment[];
}

export interface SVGSemanticGeometry {
  points?: SVGSemanticPoint[];
  endpoints?: {
    from: SVGSemanticPoint;
    to: SVGSemanticPoint;
  };
  values?: Record<string, number | string>;
  segments?: SVGSemanticSegment[];
  rings?: SVGSemanticRing[];
  holes?: SVGSemanticRing[];
}

export interface SVGSemanticBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SVGSemanticObject {
  id: string;
  kind: ResolvedObject["type"];
  /** Bounded language-level presentation semantics; raw paint/style is excluded. */
  presentation?: {
    role: string;
    intent?: string;
    label?: string;
    visible?: boolean;
    metaPreset?: string;
  };
  /** Bounded business metadata; renderer paint/style fields are excluded. */
  metadata?: Record<string, unknown>;
  children?: string[];
  references?: string[];
  transform?: ResolvedTransform;
  geometry: SVGSemanticGeometry;
}

export interface SVGSemanticView {
  id: string;
  target: string;
  scale: string | number;
  scaleFactor: number;
  bbox: SVGSemanticBoundingBox;
  objectOrder: string[];
  objects: SVGSemanticObject[];
  metadata?: Record<string, unknown>;
}

export interface SVGSemanticSheetView {
  use: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SVGSemanticSheet {
  id: string;
  size: string | [number, number];
  width: number;
  height: number;
  views: SVGSemanticSheetView[];
  metadata?: Record<string, unknown>;
}

export const SVG_SEMANTIC_PROJECTION_SCHEMA = "relgeo.svg-semantic" as const;
export const SVG_SEMANTIC_PROJECTION_VERSION = 1 as const;
export const SVG_SEMANTIC_COMPATIBILITY_LINE = "0.5" as const;
export const SVG_SEMANTIC_TOLERANCE = 1e-6 as const;

export interface SVGSemanticProjection {
  schema: typeof SVG_SEMANTIC_PROJECTION_SCHEMA;
  schemaVersion: typeof SVG_SEMANTIC_PROJECTION_VERSION;
  compatibilityLine: typeof SVG_SEMANTIC_COMPATIBILITY_LINE;
  tolerance: typeof SVG_SEMANTIC_TOLERANCE;
  unit: ResolvedScene["unit"];
  orientation?: ResolvedScene["orientation"];
  origin?: ResolvedScene["origin"];
  bbox: SVGSemanticBoundingBox;
  objectOrder: string[];
  objects: SVGSemanticObject[];
  metadata?: Record<string, unknown>;
  viewOrder: string[];
  views: SVGSemanticView[];
  sheetOrder: string[];
  sheets: SVGSemanticSheet[];
}

export interface SVGSemanticReplayComparison {
  equal: boolean;
  expected: string;
  actual: string;
}
