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
  SVGSemanticError,
} from "../index";

function loadResolvedFixture(name: string) {
  const filePath = fileURLToPath(new URL(`../../../fixtures/reference/${name}`, import.meta.url));
  return resolveGeometry(parseRelGeo(readFileSync(filePath, "utf8")));
}

describe("SVG semantic projection", () => {
  it("exposes a stable structured error for invalid projection values", () => {
    const scene = {
      unit: "px" as const,
      objects: {},
      parameters: {},
      values: {},
      bbox: { x: Number.POSITIVE_INFINITY, y: 0, width: 10, height: 10 },
    } as ResolvedScene;

    try {
      projectSVGSemanticScene(scene);
      throw new Error("expected semantic projection to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(SVGSemanticError);
      expect(error).toMatchObject({
        name: "SVGSemanticError",
        code: "INVALID_SEMANTIC_PROJECTION",
        path: "bbox.x",
      });
      expect((error as Error).message).toBe("INVALID_SEMANTIC_PROJECTION: non-finite number");
    }
  });

  it("exposes a stable structured error for invalid replay input", () => {
    try {
      compareSVGSemanticReplay("{not-json", "{}");
      throw new Error("expected semantic replay to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(SVGSemanticError);
      expect(error).toMatchObject({
        name: "SVGSemanticError",
        code: "INVALID_SEMANTIC_REPLAY",
      });
      expect((error as Error).message).toBe("INVALID_SEMANTIC_REPLAY: expected JSON input");
    }
  });

  it("reports the semantic path for non-finite replay values", () => {
    const projection = projectSVGSemanticScene({
      unit: "px",
      objects: {},
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 10, height: 10 },
    });

    try {
      compareSVGSemanticReplay(projection, {
        ...projection,
        bbox: { ...projection.bbox, width: Number.NaN },
      });
      throw new Error("expected semantic replay to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(SVGSemanticError);
      expect(error).toMatchObject({
        code: "INVALID_SEMANTIC_REPLAY",
        path: "root.bbox.width",
      });
    }
  });

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

  it("projects document metadata, business metadata, views, and sheets without raw paint fields", () => {
    const scene: ResolvedScene = {
      unit: "mm",
      meta: {
        title: "Bracket Assembly",
        author: "RelGeo",
        version: "A-01",
      },
      objects: {
        plate: {
          id: "plate",
          type: "rect",
          x: 0,
          y: 0,
          width: 40,
          height: 20,
          meta: {
            material: "aluminum",
            thickness: 2,
            process: "laser-cut",
            partNo: "P-001",
            description: "Main plate",
            stroke: "<script>",
          },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 40, height: 20 },
      views: {
        front: {
          id: "front",
          target: "plate",
          scale: "1:1",
          scaleFactor: 1,
          objects: {
            plate: {
              id: "plate",
              type: "rect",
              x: 0,
              y: 0,
              width: 40,
              height: 20,
            },
          },
          bbox: { x: 0, y: 0, width: 40, height: 20 },
          meta: { title: "Front view" },
        },
      },
      sheets: {
        drawing1: {
          id: "drawing1",
          size: "A4",
          width: 297,
          height: 210,
          views: [{ use: "front", x: 20, y: 20, width: 40, height: 20 }],
          meta: { title: "Assembly sheet" },
        },
      },
    };

    const projection = projectSVGSemanticScene(scene);

    expect(projection.metadata).toEqual({ title: "Bracket Assembly", author: "RelGeo", version: "A-01" });
    expect(projection.objects[0].metadata).toEqual({
      description: "Main plate",
      material: "aluminum",
      partNo: "P-001",
      process: "laser-cut",
      thickness: 2,
    });
    expect(JSON.stringify(projection.objects[0].metadata)).not.toContain("<script>");
    expect(projection.viewOrder).toEqual(["front"]);
    expect(projection.views[0]).toMatchObject({
      id: "front",
      target: "plate",
      objectOrder: ["plate"],
      metadata: { title: "Front view" },
    });
    expect(projection.sheetOrder).toEqual(["drawing1"]);
    expect(projection.sheets[0]).toMatchObject({
      id: "drawing1",
      size: "A4",
      metadata: { title: "Assembly sheet" },
      views: [{ use: "front", x: 20, y: 20, width: 40, height: 20 }],
    });

    const reordered = structuredClone(scene);
    reordered.meta = { version: "A-01", title: "Bracket Assembly", author: "RelGeo" };
    expect(serializeSVGSemanticScene(reordered)).toBe(serializeSVGSemanticScene(scene));
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

  it("uses the published semantic tolerance for numeric geometry while keeping topology strict", () => {
    const projection = projectSVGSemanticScene({
      unit: "px",
      objects: {
        point: { id: "point", type: "point", x: 10, y: 20 },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 10, height: 20 },
    });
    const withinTolerance = structuredClone(projection);
    withinTolerance.bbox.width += SVG_SEMANTIC_TOLERANCE / 2;
    const outsideTolerance = structuredClone(projection);
    outsideTolerance.bbox.width += SVG_SEMANTIC_TOLERANCE * 2;
    const reordered = structuredClone(projection);
    reordered.objectOrder = ["missing"];

    expect(compareSVGSemanticReplay(projection, withinTolerance).equal).toBe(true);
    expect(compareSVGSemanticReplay(projection, outsideTolerance).equal).toBe(false);
    expect(compareSVGSemanticReplay(projection, reordered).equal).toBe(false);
    expect(compareSVGSemanticReplay(projection, {
      ...projection,
      schemaVersion: 1.0000005 as typeof projection.schemaVersion,
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

  it("projects bounded presentation semantics without projecting raw style", () => {
    const scene: ResolvedScene = {
      unit: "mm",
      objects: {
        datum: {
          id: "datum",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 10,
          y2: 0,
          metaPreset: "datumPreset",
          meta: {
            role: "centerline",
            intent: "datum",
            label: "A <main>",
            visible: true,
            stroke: "<script>",
            fontFamily: '"><text>',
          },
        } as any,
        note: {
          id: "note",
          type: "annotation",
          text: "note",
          place: { x: 2, y: 3 },
        } as any,
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 10, height: 3 },
    };

    const projection = projectSVGSemanticScene(scene);
    expect(projection.objects[0].presentation).toEqual({
      role: "centerline",
      intent: "datum",
      label: "A <main>",
      visible: true,
      metaPreset: "datumPreset",
    });
    expect(projection.objects[1].presentation).toEqual({ role: "annotation" });
    expect(JSON.stringify(projection)).not.toContain("<script>");
    expect(JSON.stringify(projection)).not.toContain("fontFamily");
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
