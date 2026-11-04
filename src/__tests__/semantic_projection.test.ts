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
    expect(projection.objects.find((object) => object.id === "line")).toMatchObject({
      id: "line",
      kind: "line",
      geometry: {
        endpoints: {
          from: { x: 0, y: 0 },
          to: { x: 10.123456789012, y: 20 },
        },
      },
    });
    expect(projection.objects.find((object) => object.id === "outline")?.geometry.rings).toHaveLength(1);
    expect(projection.objects.find((object) => object.id === "outline")?.geometry.holes).toHaveLength(1);
    expect(projection.objects.find((object) => object.id === "assembly")?.children).toEqual(["line", "outline"]);
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

  it("canonicalizes object order and preserves dimension/annotation placement semantics", () => {
    const scene: ResolvedScene = {
      unit: "mm",
      objects: {
        note: {
          id: "note",
          type: "annotation",
          target: "panel",
          text: "Inspect",
          leader: { from: { x: 10, y: 10 }, to: { x: 40, y: 25 } },
          place: { x: 40, y: 25, width: 42, height: 12 },
        },
        panel: { id: "panel", type: "rect", x: 0, y: 0, width: 30, height: 20 },
        width: {
          id: "width",
          type: "dimension",
          kind: "linear",
          from: { x: 0, y: 0 },
          to: { x: 30, y: 0 },
          offset: 6,
          distance: 30,
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 30, height: 25 },
    };

    const projection = projectSVGSemanticScene(scene);
    expect(projection.objectOrder).toEqual(["note", "panel", "width"]);
    expect(projection.objects.find((object) => object.id === "width")).toMatchObject({
      geometry: {
        endpoints: { from: { x: 0, y: 0 }, to: { x: 30, y: 0 } },
        values: { kind: "linear", offset: 6, distance: 30 },
      },
    });
    expect(projection.objects.find((object) => object.id === "note")).toMatchObject({
      references: ["panel"],
      geometry: {
        endpoints: { from: { x: 10, y: 10 }, to: { x: 40, y: 25 } },
        values: { x: 40, y: 25, width: 42, height: 12 },
      },
    });
  });

  it("retains explicit object order so semantic replay detects a reorder", () => {
    const base = {
      unit: "px" as const,
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 10, height: 10 },
    };
    const first: ResolvedScene = {
      ...base,
      objects: {
        zeta: { id: "zeta", type: "point", x: 2, y: 2 },
        alpha: { id: "alpha", type: "point", x: 1, y: 1 },
      },
    };
    const second: ResolvedScene = {
      ...base,
      objects: {
        alpha: { id: "alpha", type: "point", x: 1, y: 1 },
        zeta: { id: "zeta", type: "point", x: 2, y: 2 },
      },
    };

    expect(serializeSVGSemanticScene(first)).not.toBe(serializeSVGSemanticScene(second));
  });
});
