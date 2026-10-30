import type {
  PathResolvedSegment,
  ResolvedObject,
  ResolvedScene,
} from "@relgeo/geometry";
import {
  SVG_SEMANTIC_COMPATIBILITY_LINE,
  SVG_SEMANTIC_PROJECTION_SCHEMA,
  SVG_SEMANTIC_PROJECTION_VERSION,
  SVG_SEMANTIC_TOLERANCE,
  SVGSemanticGeometry,
  SVGSemanticObject,
  SVGSemanticPoint,
  SVGSemanticProjection,
  SVGSemanticRing,
  SVGSemanticSegment,
} from "./types";

const NUMBER_PRECISION = 12;

function normalizeNumber(value: number, path: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`INVALID_SEMANTIC_PROJECTION: non-finite number at ${path}`);
  }
  const normalized = Number(value.toFixed(NUMBER_PRECISION));
  return Object.is(normalized, -0) ? 0 : normalized;
}

function point(x: number, y: number, path: string): SVGSemanticPoint {
  return {
    x: normalizeNumber(x, `${path}.x`),
    y: normalizeNumber(y, `${path}.y`),
  };
}

function segment(segment: PathResolvedSegment, path: string): SVGSemanticSegment {
  const base = {
    type: segment.type,
    from: point(segment.x1, segment.y1, `${path}.from`),
    to: point(segment.x2, segment.y2, `${path}.to`),
  } as SVGSemanticSegment;

  if (segment.type === "arc") {
    return {
      ...base,
      controlPoints: segment.xt === undefined || segment.yt === undefined
        ? undefined
        : [point(segment.xt, segment.yt, `${path}.through`)],
      radius: normalizeNumber(segment.radius, `${path}.radius`),
      sweep: segment.sweep,
      largeArc: segment.largeArc,
    };
  }

  if (segment.type === "quadratic") {
    return {
      ...base,
      controlPoints: [point(segment.cpx, segment.cpy, `${path}.control`)],
    };
  }

  if (segment.type === "cubic") {
    return {
      ...base,
      controlPoints: [
        point(segment.cp1x, segment.cp1y, `${path}.control1`),
        point(segment.cp2x, segment.cp2y, `${path}.control2`),
      ],
    };
  }

  return base;
}

function rings(segments: PathResolvedSegment[], path: string): SVGSemanticRing[] {
  const groups: PathResolvedSegment[][] = [];
  for (const item of segments) {
    const current = groups[groups.length - 1];
    const previous = current?.[current.length - 1];
    const startsNewRing = previous && (
      Math.abs(item.x1 - previous.x2) > SVG_SEMANTIC_TOLERANCE
      || Math.abs(item.y1 - previous.y2) > SVG_SEMANTIC_TOLERANCE
    );
    if (!current || startsNewRing) groups.push([item]);
    else current.push(item);
  }
  return groups.map((group, index) => ({
    closed: true,
    segments: group.map((item, segmentIndex) => segment(item, `${path}[${index}].segments[${segmentIndex}]`)),
  }));
}

function pathGeometry(obj: any, path: string): SVGSemanticGeometry {
  const geometry: SVGSemanticGeometry = {};
  if (Array.isArray(obj.points)) {
    geometry.points = obj.points.map((item: SVGSemanticPoint, index: number) =>
      point(item.x, item.y, `${path}.points[${index}]`),
    );
  }
  if (Array.isArray(obj.segments)) {
    geometry.segments = obj.segments.map((item: PathResolvedSegment, index: number) =>
      segment(item, `${path}.segments[${index}]`),
    );
    const isClosed = obj.closed === true || obj.type === "polygon" || obj.type === "boolean";
    if (isClosed) geometry.rings = rings(obj.segments, `${path}.rings`);
  }
  if (Array.isArray(obj.holes)) {
    geometry.holes = obj.holes.flatMap((hole: { segments: PathResolvedSegment[] }, index: number) =>
      rings(hole.segments ?? [], `${path}.holes[${index}]`),
    );
  }
  return geometry;
}

function endpoints(from: SVGSemanticPoint, to: SVGSemanticPoint): SVGSemanticGeometry {
  return { endpoints: { from, to } };
}

function projectObject(obj: ResolvedObject, path: string): SVGSemanticObject {
  const raw = obj as any;
  const result: SVGSemanticObject = {
    id: obj.id,
    kind: obj.type,
    geometry: {},
  };

  if (Array.isArray(raw.children)) result.children = [...raw.children];
  const references = [raw.target, raw.of, ...(Array.isArray(raw.between) ? raw.between : [])]
    .filter((value): value is string => typeof value === "string");
  if (references.length > 0) result.references = references;
  if (Array.isArray(raw.transform)) {
    result.transform = raw.transform.map((transform: any, index: number) => {
      const normalized = { ...transform };
      if (transform.type === "translate") {
        normalized.x = normalizeNumber(transform.x, `${path}.transform[${index}].x`);
        normalized.y = normalizeNumber(transform.y, `${path}.transform[${index}].y`);
      } else if (transform.type === "rotate") {
        normalized.angle = normalizeNumber(transform.angle, `${path}.transform[${index}].angle`);
        normalized.origin = point(transform.origin.x, transform.origin.y, `${path}.transform[${index}].origin`);
      } else if (transform.type === "scale") {
        normalized.factor = transform.factor.map((value: number, factorIndex: number) =>
          normalizeNumber(value, `${path}.transform[${index}].factor[${factorIndex}]`),
        );
        normalized.origin = point(transform.origin.x, transform.origin.y, `${path}.transform[${index}].origin`);
      } else if (transform.type === "mirror") {
        normalized.origin = point(transform.origin.x, transform.origin.y, `${path}.transform[${index}].origin`);
      }
      return normalized;
    });
  }

  switch (obj.type) {
    case "point":
      result.geometry = { points: [point(raw.x, raw.y, `${path}.point`)] };
      break;
    case "line":
      result.geometry = endpoints(
        point(raw.x1, raw.y1, `${path}.from`),
        point(raw.x2, raw.y2, `${path}.to`),
      );
      break;
    case "rect":
      result.geometry = {
        values: {
          x: normalizeNumber(raw.x, `${path}.x`),
          y: normalizeNumber(raw.y, `${path}.y`),
          width: normalizeNumber(raw.width, `${path}.width`),
          height: normalizeNumber(raw.height, `${path}.height`),
        },
        ...pathGeometry(raw, path),
      };
      break;
    case "circle":
      result.geometry = {
        values: {
          cx: normalizeNumber(raw.cx, `${path}.cx`),
          cy: normalizeNumber(raw.cy, `${path}.cy`),
          radius: normalizeNumber(raw.radius, `${path}.radius`),
        },
        ...pathGeometry(raw, path),
      };
      break;
    case "ellipse":
      result.geometry = {
        values: {
          cx: normalizeNumber(raw.cx, `${path}.cx`),
          cy: normalizeNumber(raw.cy, `${path}.cy`),
          rx: normalizeNumber(raw.rx, `${path}.rx`),
          ry: normalizeNumber(raw.ry, `${path}.ry`),
          ...(raw.rotation === undefined ? {} : { rotation: normalizeNumber(raw.rotation, `${path}.rotation`) }),
        },
        ...pathGeometry(raw, path),
      };
      break;
    case "arc":
      result.geometry = {
        ...endpoints(
          point(raw.x1, raw.y1, `${path}.from`),
          point(raw.x2, raw.y2, `${path}.to`),
        ),
        values: {
          radius: normalizeNumber(raw.radius, `${path}.radius`),
          ...(raw.sweep === undefined ? {} : { sweep: raw.sweep }),
          ...(raw.largeArc === undefined ? {} : { largeArc: raw.largeArc }),
        },
      };
      break;
    case "quadratic":
      result.geometry = {
        ...endpoints(
          point(raw.x1, raw.y1, `${path}.from`),
          point(raw.x2, raw.y2, `${path}.to`),
        ),
        values: {
          cpx: normalizeNumber(raw.cpx, `${path}.cpx`),
          cpy: normalizeNumber(raw.cpy, `${path}.cpy`),
        },
      };
      break;
    case "cubic":
      result.geometry = {
        ...endpoints(
          point(raw.x1, raw.y1, `${path}.from`),
          point(raw.x2, raw.y2, `${path}.to`),
        ),
        values: {
          cp1x: normalizeNumber(raw.cp1x, `${path}.cp1x`),
          cp1y: normalizeNumber(raw.cp1y, `${path}.cp1y`),
          cp2x: normalizeNumber(raw.cp2x, `${path}.cp2x`),
          cp2y: normalizeNumber(raw.cp2y, `${path}.cp2y`),
        },
      };
      break;
    case "path":
    case "polygon":
    case "boolean":
      result.geometry = pathGeometry(raw, path);
      break;
    case "text":
      result.geometry = {
        values: {
          x: normalizeNumber(raw.x, `${path}.x`),
          y: normalizeNumber(raw.y, `${path}.y`),
          width: normalizeNumber(raw.width, `${path}.width`),
          height: normalizeNumber(raw.height, `${path}.height`),
        },
      };
      break;
    case "dimension":
      result.geometry = {
        ...(raw.from && raw.to
          ? endpoints(point(raw.from.x, raw.from.y, `${path}.from`), point(raw.to.x, raw.to.y, `${path}.to`))
          : {}),
        values: {
          ...(raw.offset === undefined ? {} : { offset: normalizeNumber(raw.offset, `${path}.offset`) }),
          ...(raw.distance === undefined ? {} : { distance: normalizeNumber(raw.distance, `${path}.distance`) }),
          ...(raw.angle === undefined ? {} : { angle: normalizeNumber(raw.angle, `${path}.angle`) }),
        },
      };
      break;
    case "annotation":
      result.geometry = raw.leader
        ? endpoints(
          point(raw.leader.from.x, raw.leader.from.y, `${path}.leader.from`),
          point(raw.leader.to.x, raw.leader.to.y, `${path}.leader.to`),
        )
        : {};
      break;
    default:
      break;
  }

  return result;
}

export function projectSVGSemanticScene(scene: ResolvedScene): SVGSemanticProjection {
  const objectOrder = Object.keys(scene.objects ?? {});
  const bbox = scene.bbox;
  return {
    schema: SVG_SEMANTIC_PROJECTION_SCHEMA,
    schemaVersion: SVG_SEMANTIC_PROJECTION_VERSION,
    compatibilityLine: SVG_SEMANTIC_COMPATIBILITY_LINE,
    tolerance: SVG_SEMANTIC_TOLERANCE,
    unit: scene.unit,
    ...(scene.orientation === undefined ? {} : { orientation: scene.orientation }),
    ...(scene.origin === undefined ? {} : { origin: scene.origin }),
    bbox: {
      x: normalizeNumber(bbox.x, "bbox.x"),
      y: normalizeNumber(bbox.y, "bbox.y"),
      width: normalizeNumber(bbox.width, "bbox.width"),
      height: normalizeNumber(bbox.height, "bbox.height"),
    },
    objectOrder: [...objectOrder],
    objects: objectOrder.map((id) => projectObject(scene.objects[id], `objects.${id}`)),
  };
}

export function serializeSVGSemanticScene(scene: ResolvedScene): string {
  return JSON.stringify(projectSVGSemanticScene(scene));
}
