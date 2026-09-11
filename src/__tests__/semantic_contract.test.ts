import { describe, it, expect } from "vitest";
import { parseRelGeo, resolveGeometry, getObjectDependencies, normalizeUnit, evaluateExpression } from "@relgeo/core";
import type { ResolvedRect } from "@relgeo/geometry";
import { renderToSVG } from "../index";

describe("Semantic Contract Strengthening", () => {
  describe("Validator - Point on Line/Segment", () => {
    it("should validate point.on.line identifier", () => {
      const yaml = `
version: 0.1
objects:
  P:
    type: point
    on: { path: { path: UNKNOWN, t: 0.5 } }
`;
      expect(() => parseRelGeo(yaml, { strict: true })).toThrow("Unknown reference: UNKNOWN");
    });

    it("should reject point.on with both segment and line", () => {
      const yaml = `
version: 0.1
objects:
  A: { type: point, at: origin }
  B: { type: point, at: [10, 0] }
  L: { type: line, from: A, to: B }
  P:
    type: point
    on: { point: { at: [0,0] }, path: { path: L, t: 0.5 } }
`;
      expect(() => parseRelGeo(yaml, { strict: true })).toThrow("placement cannot combine multiple namespaces");
    });
  });

  describe("Validator - Line Shape", () => {
    it("should reject line without from", () => {
      const yaml = `
version: 0.1
objects:
  L: { type: line, to: [10, 10] }
`;
      expect(() => parseRelGeo(yaml, { strict: true })).toThrow('requires "from"');
    });

    it("should reject line with both to and direction/length", () => {
      const yaml = `
version: 0.1
objects:
  A: { type: point, at: origin }
  L: { type: line, from: A, to: [10, 10], direction: right, length: 50 }
`;
      expect(() => parseRelGeo(yaml, { strict: true })).toThrow('cannot use both "to" and "direction/length"');
    });

    it("should reject line without any endpoint definition", () => {
      const yaml = `
version: 0.1
objects:
  A: { type: point, at: origin }
  L: { type: line, from: A }
`;
      expect(() => parseRelGeo(yaml, { strict: true })).toThrow('requires either "to" or "direction/length"');
    });
  });

  describe("Validator - Circle Shape & Constraints", () => {
    it("should reject circle with both radius and through", () => {
      const yaml = `
version: 0.1
objects:
  A: { type: point, at: origin }
  C: { type: circle, center: A, radius: 10, through: [10, 10] }
`;
      expect(() => parseRelGeo(yaml, { strict: true })).toThrow('cannot use both "radius" and "through"');
    });

    it("should reject circle without radius or through", () => {
      const yaml = `
version: 0.1
objects:
  A: { type: point, at: origin }
  C: { type: circle, center: A }
`;
      expect(() => parseRelGeo(yaml, { strict: true })).toThrow('requires either "radius" or "through"');
    });
  });

  describe("Parser - Rect Size", () => {
    it("should reject rect size with wrong tuple length", () => {
      const yaml = `
version: 0.1
objects:
  R: { type: rect, size: [100], place: { left: 0, top: 0 } }
`;
      expect(() => parseRelGeo(yaml, { mode: "validate" })).toThrow('requires size: [width, height]');
    });
  });

  describe("Evaluator - Math Context", () => {
    it("should throw if identifier resolves to a non-number in math context", () => {
      const ctx = {
        scalars: {},
        targetUnit: "px" as const,
        resolveIdentifier: (name: string) => name === "A" ? { x: 10, y: 10 } : undefined
      };
      expect(() => evaluateExpression("A + 1", ctx)).toThrow('Identifier "A" does not resolve to a number');
    });
  });

  describe("Validator - Place Fields", () => {
    it("should reject unknown place fields", () => {
      const yaml = `
version: 0.1
objects:
  R:
    type: rect
    size: [100, 100]
    place: { left: 0, top: 0, kiri: 10 }
`;
      expect(() => parseRelGeo(yaml, { strict: true })).toThrow("Unknown place field: kiri");
    });
  });

  describe("Validator - Circle XOR & Constraints", () => {
    it("should reject circle with both center and place", () => {
      const yaml = `
version: 0.1
objects:
  A: { type: point, at: origin }
  C:
    type: circle
    center: A
    radius: 10
    place: { left: 50 }
`;
      expect(() => parseRelGeo(yaml, { strict: true })).toThrow("cannot use both center and place");
    });

    it("should reject circle with incomplete place constraints (must have both axes in v0.2)", () => {
      const yaml = `
version: 0.2
objects:
  C: { type: circle, radius: 10, place: { left: 50 } }
`;
      expect(() => parseRelGeo(yaml, { strict: true })).toThrow("UNDER_CONSTRAINED");
    });

    it("should accept circle with complete place constraints", () => {
      const yaml = `
version: 0.1
objects:
  C: { type: circle, radius: 10, place: { left: 50, top: 50 } }
`;
      expect(() => parseRelGeo(yaml, { strict: true })).not.toThrow();
    });

    it("should reject circle with unknown place fields", () => {
      const yaml = `
version: 0.1
objects:
  C: { type: circle, radius: 10, place: { left: 50, top: 50, unknown: 10 } }
`;
      expect(() => parseRelGeo(yaml, { strict: true })).toThrow("Unknown place field: unknown");
    });
  });

  describe("Validator - Group Place", () => {
    it("should accept group with place field in v0.2", () => {
      const yaml = `
version: 0.2
objects:
  G:
    type: group
    children: []
    place: { left: 0, top: 0 }
`;
      expect(() => parseRelGeo(yaml, { strict: true })).not.toThrow();
    });
  });

  describe("Validator - Rect Constraints (Strict Position)", () => {
    it("should accept rect without 'place' in v0.2", () => {
      const yaml = `
version: 0.2
objects:
  R:
    type: rect
    size: [100, 100]
`;
      expect(() => parseRelGeo(yaml, { strict: true })).not.toThrow();
    });

    it("should reject rect over-constrained (multiple horizontal positions)", () => {
      const yaml = `
version: 0.1
objects:
  R:
    type: rect
    size: [100, 100]
    place: { left: 0, right: 100, top: 0 }
`;
      expect(() => parseRelGeo(yaml, { strict: true })).toThrow("over-constrained horizontally");
    });
  });

  describe("Resolver - Strict resolveInside & normalizeUnit", () => {
    it("should throw error when resolveInside parent is unknown", () => {
      const yaml = `
version: 0.1
objects:
  R: { type: rect, size: [100, 100], place: { inside: UNKNOWN, margin: 10 } }
`;
      const doc = parseRelGeo(yaml, { mode: "editor" });
      expect(() => resolveGeometry(doc)).toThrow("INVALID_EXPRESSION: Invalid expression syntax: Unknown identifier: UNKNOWN");
    });

    it("should throw error when resolveGeometry encounters an unknown identifier in size", () => {
      const yaml = `
version: 0.1
objects:
  R: { type: rect, size: ["abc", 100], place: { left: 0, top: 0 } }
`;
      const doc = parseRelGeo(yaml, { mode: "editor" });
      expect(() => resolveGeometry(doc)).toThrow("INVALID_EXPRESSION: Invalid expression syntax: Unknown identifier: abc");
    });
  });

  describe("Units - Strict Validation", () => {
    it("should preserve non-unit string literals when normalizeUnit receives them", () => {
      expect(normalizeUnit("not-a-number")).toBe("not-a-number");
    });
  });

  describe("Graph - Dependency Tracking", () => {
    it("should NOT track meta.label as a dependency", () => {
      const doc = parseRelGeo(`
version: 0.1
objects:
  A: { type: point, at: origin }
  B: { type: point, from: A, move: { right: 10 }, meta: { label: "Ref to A" } }
`);
      const deps = getObjectDependencies("B", doc.objects.B, new Set(["A"]));
      // Only from: A should be a dependency. meta.label should be ignored.
      expect(deps).toEqual(["A"]);
    });
  });

  describe("Renderer - Scene Origin", () => {
    it("should not mutate coordinates in resolver, but shift visually in renderer (center)", () => {
      const yaml = `
version: 0.1
scene: { origin: center }
objects:
  R: { type: rect, size: [100, 100], place: { left: 0, top: 0 } }
`;
      const doc = parseRelGeo(yaml);
      const resolved = resolveGeometry(doc);
      
      // Resolver should keep raw coordinates
      expect((resolved.objects.R as ResolvedRect).x).toBe(0);
      expect((resolved.objects.R as ResolvedRect).y).toBe(0);

      const svg = renderToSVG(resolved);
      expect(svg).toContain('viewBox="-70 -70 140 140"');
      expect(svg).toContain('transform="translate(-50, -50)"');
    });

    it("should handle bottom-left origin in renderer", () => {
      const yaml = `
version: 0.1
scene: { origin: bottom-left }
objects:
  R: { type: rect, size: [100, 100], place: { left: 0, top: 0 } }
`;
      const doc = parseRelGeo(yaml);
      const resolved = resolveGeometry(doc);
      
      expect((resolved.objects.R as ResolvedRect).x).toBe(0);
      expect((resolved.objects.R as ResolvedRect).y).toBe(0);

      const svg = renderToSVG(resolved);
      expect(svg).toContain('viewBox="-20 -120 140 140"');
      expect(svg).toContain('transform="translate(0, -100)"');
    });
  });
});
