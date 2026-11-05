import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseRelGeo, resolveGeometry } from "@relgeo/core";
import type { ResolvedScene } from "@relgeo/geometry";
import {
  compareSVGSemanticReplay,
  projectSVGSemanticScene,
  serializeSVGSemanticScene,
  SVG_SEMANTIC_TOLERANCE,
} from "../index";

function loadResolvedFixture(name: string) {
  const filePath = fileURLToPath(new URL(`../../../fixtures/reference/${name}`, import.meta.url));
  return resolveGeometry(parseRelGeo(readFileSync(filePath, "utf8")));
}

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
          transform: [{ type: "translate", x: 3, y: 4 }],
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
      transform: [{ type: "translate", x: 3, y: 4 }],
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

  it("compares canonical replay fields while preserving semantic array order", () => {
    const projection = projectSVGSemanticScene({
      unit: "px",
      objects: {
        first: { id: "first", type: "point", x: 1, y: 2 },
        second: { id: "second", type: "line", x1: 1, y1: 2, x2: 4, y2: 5 },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 4, height: 5 },
    });

    const reorderedKeys = JSON.parse(JSON.stringify(projection)) as typeof projection;
    reorderedKeys.bbox.x = 0.0000000000004;
    reorderedKeys.objects = [...reorderedKeys.objects].reverse();
    const keyOrderOnly = {
      ...reorderedKeys,
      objects: [...reorderedKeys.objects].reverse(),
    };

    expect(compareSVGSemanticReplay(projection, JSON.stringify(keyOrderOnly)).equal).toBe(true);
    expect(compareSVGSemanticReplay(projection, reorderedKeys).equal).toBe(false);
    expect(compareSVGSemanticReplay(projection, {
      ...projection,
      schemaVersion: 2 as typeof projection.schemaVersion,
    }).equal).toBe(false);
  });

  it("replays semantic projections across canonical fixture resolutions", () => {
    for (const fixture of [
      "10-v05-relational-baseline.yaml",
      "15-v05-boolean-intersection-candidate.yaml",
      "16-v05-evaluator-units-candidate.yaml",
    ]) {
      const first = serializeSVGSemanticScene(loadResolvedFixture(fixture));
      const second = serializeSVGSemanticScene(loadResolvedFixture(fixture));
      expect(compareSVGSemanticReplay(first, second).equal, fixture).toBe(true);
    }
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

  it("projects text content and anchor semantics alongside its measured box", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        label: {
          id: "label",
          type: "text",
          x: 32,
          y: 54,
          width: 36,
          height: 12,
          content: "Hello\nWorld",
          anchor: "center",
        } as any,
      },
      parameters: {},
      values: {},
      bbox: { x: 32, y: 54, width: 36, height: 12 },
    };

    expect(projectSVGSemanticScene(scene).objects[0]).toMatchObject({
      id: "label",
      kind: "text",
      geometry: {
        values: {
          x: 32,
          y: 54,
          width: 36,
          height: 12,
          content: "Hello\nWorld",
          anchor: "center",
        },
      },
    });
  });

  it("keeps semantic geometry stable when presentation metadata changes", () => {
    const base: ResolvedScene = {
      unit: "mm",
      objects: {
        plate: {
          id: "plate",
          type: "rect",
          x: 2,
          y: 3,
          width: 40,
          height: 20,
          meta: { stroke: "#111", fontFamily: "sans-serif" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 2, y: 3, width: 40, height: 20 },
    };
    const styled = structuredClone(base);
    styled.objects.plate.meta = { stroke: "<script>", fill: "\"><text>", fontSize: "NaN" };

    expect(projectSVGSemanticScene(styled)).toEqual(projectSVGSemanticScene(base));
  });

  it("derives closed rings for point-authored paths without resolved segments", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        outline: {
          id: "outline",
          type: "path",
          closed: true,
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
          ],
        } as any,
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 10, height: 10 },
    };

    const outline = projectSVGSemanticScene(scene).objects[0];
    expect(outline.geometry.rings).toHaveLength(1);
    expect(outline.geometry.rings?.[0].segments).toHaveLength(4);
    expect(outline.geometry.rings?.[0].segments.at(-1)).toMatchObject({
      from: { x: 0, y: 10 },
      to: { x: 0, y: 0 },
    });
  });
});
