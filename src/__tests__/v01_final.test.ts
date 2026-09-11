import { describe, it, expect } from "vitest";
import { evaluateExpression, type EvalContext, resolveGeometry, parseRelGeo } from "relgeo-core";
import type { ResolvedRect } from "relgeo-geometry";
import { renderToSVG } from "../index";

describe("v0.1 Final Gap Closure", () => {
  it("should calculate distance between two points", () => {
    const ctx: EvalContext = {
      scalars: {},
      targetUnit: "px",
      objects: {
        A: { id: "A", type: "point", x: 0, y: 0 },
        B: { id: "B", type: "point", x: 30, y: 40 },
      },
    };
    const result = evaluateExpression("distance(A, B)", ctx);
    expect(result).toBe(50); // 3-4-5 triangle
  });

  it("should calculate length of a line", () => {
    const ctx: EvalContext = {
      scalars: {},
      targetUnit: "px",
      objects: {
        L1: { id: "L1", type: "line", x1: 10, y1: 10, x2: 110, y2: 10 },
      },
    };
    const result = evaluateExpression("length(L1)", ctx);
    expect(result).toBe(100);
  });

  it("should support y-up orientation in renderer", () => {
    const yaml = `
version: 0.1
scene:
  orientation: y-up
objects:
  A: { type: point, at: [0, 0] }
  B: { type: point, at: [100, 100] }
`;
    const doc = parseRelGeo(yaml);
    const resolved = resolveGeometry(doc);
    const svg = renderToSVG(resolved);
    
    expect(svg).toContain('transform="scale(1, -1)');
    expect(svg).toContain('viewBox="-20 -20 140 140"');
  });

  it("should return parameter metadata in resolved model", () => {
    const yaml = `
version: 0.1
parameters:
  width: { type: length, default: "100px", min: 50, max: 200 }
objects: {}
`;
    const doc = parseRelGeo(yaml);
    const resolved = resolveGeometry(doc);
    const widthParam = resolved.parameters.width as any;
    expect(widthParam.min).toBe(50);
    expect(widthParam.max).toBe(200);
    expect(resolved.values.width).toBe(100);
  });

  it("should propagate group opacity to children in renderer", () => {
    const scene: any = {
      unit: "px",
      objects: {
        G1: { id: "G1", type: "group", children: ["A"], meta: { opacity: 0.5 } },
        A: { id: "A", type: "point", x: 10, y: 10, meta: { opacity: 0.8 } },
      }
    };
    const svg = renderToSVG(scene);
    expect(svg).toContain('opacity="0.5"'); // Group opacity
    expect(svg).toContain('opacity="0.4"'); // Child opacity (0.5 * 0.8)
  });

  it("should handle explicit align constraints in resolver (v0.2 validation)", () => {
    const yaml = `
version: 0.2
objects:
  box2: { type: rect, size: [50, 50], place: { topLeft: [200, 200] } }
  box1: { type: rect, size: [100, 100], place: { left: "box2.right", top: 0 } }
constraints:
  - align: { target: "box1.left", with: "box2.right" }
`;
    const doc = parseRelGeo(yaml);
    const resolved = resolveGeometry(doc);
    // box2.right is 200 + 50 = 250
    // box1.left is explicitly set to box2.right, so it should be 250
    expect((resolved.objects.box1 as ResolvedRect).x).toBe(250);
  });
});
