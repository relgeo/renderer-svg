import { describe, expect, it } from "vitest";
import type { ResolvedScene } from "@relgeo/geometry";
import {
  projectSVGSemanticScene,
  serializeSVGSemanticScene,
  SVG_SEMANTIC_TOLERANCE,
} from "../index";

describe("SVG semantic projection", () => {
  it("exposes stable identity, order, primitive geometry, and path topology", () => {
    const scene: ResolvedScene = {
      unit: "mm",
      origin: "top-left",
      objects: {
        line: {
          id: "line",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 10.12345678901234,
          y2: 20,
        },
        outline: {
          id: "outline",
          type: "path",
          closed: true,
          segments: [
            { type: "line", x1: 0, y1: 0, x2: 10, y2: 0 },
            { type: "line", x1: 10, y1: 0, x2: 10, y2: 10 },
          ],
          holes: [{
            segments: [{ type: "line", x1: 2, y1: 2, x2: 4, y2: 2 }],
          }],
        },
        assembly: {
          id: "assembly",
          type: "group",
          children: ["line", "outline"],
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 10, height: 20 },
    };

    const projection = projectSVGSemanticScene(scene);
    expect(projection.schema).toBe("relgeo.svg-semantic");
    expect(projection.schemaVersion).toBe(1);
    expect(projection.compatibilityLine).toBe("0.5");
    expect(projection.tolerance).toBe(SVG_SEMANTIC_TOLERANCE);
    expect(projection.objectOrder).toEqual(["line", "outline", "assembly"]);
    expect(projection.objects[0]).toMatchObject({
      id: "line",
      kind: "line",
      geometry: {
        endpoints: {
          from: { x: 0, y: 0 },
          to: { x: 10.123456789012, y: 20 },
        },
      },
    });
    expect(projection.objects[1].geometry.rings).toHaveLength(1);
    expect(projection.objects[1].geometry.holes).toHaveLength(1);
    expect(projection.objects[2].children).toEqual(["line", "outline"]);
  });

  it("serializes the same resolved scene deterministically", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        box: { id: "box", type: "rect", x: 0, y: 0, width: 10, height: 20 },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 10, height: 20 },
    };

    expect(serializeSVGSemanticScene(scene)).toBe(serializeSVGSemanticScene(scene));
  });
});
