import { describe, it, expect } from "vitest";
import { renderToSVG } from "../index";
import type { ResolvedScene } from "relgeo-geometry";

describe("renderer", () => {
  it("should render a simple rect to SVG", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        box: {
          id: "box",
          type: "rect",
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          meta: { stroke: "red" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 10, y: 10, width: 100, height: 100 }
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('<rect x="10" y="10" width="100" height="100"');
    expect(svg).toContain('stroke="red"');
    expect(svg).toContain('viewBox="-10 -10 140 140"'); // 100 + 20*2 = 140
  });

  it("should render multiple objects and calculate correct viewBox", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        A: { id: "A", type: "point", x: 0, y: 0 },
        B: { id: "B", type: "point", x: 100, y: 100 },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 100, height: 100 }
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('<path d="M -1.4142135623730951 0 L 1.4142135623730951 0 M 0 -1.4142135623730951 L 0 1.4142135623730951"');
    expect(svg).toContain('<path d="M 98.58578643762691 100 L 101.41421356237309 100 M 100 98.58578643762691 L 100 101.41421356237309"');
    expect(svg).toContain('viewBox="-20 -20 140 140"');
  });

  it("should let render options override scene padding", () => {
    const scene: ResolvedScene = {
      unit: "px",
      padding: 20,
      objects: {
        box: {
          id: "box",
          type: "rect",
          x: 0,
          y: 0,
          width: 80,
          height: 40,
          meta: {},
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 80, height: 40 }
    };

    const svg = renderToSVG(scene, { padding: 0 });
    expect(svg).toContain('viewBox="0 0 80 40"');
  });

  it("should render target-only annotation via resolved fallback placement", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        hole: {
          id: "hole",
          type: "circle",
          cx: 50,
          cy: 50,
          radius: 10,
          meta: {},
        },
        note: {
          id: "note",
          type: "annotation",
          target: "hole",
          text: "M6 clearance",
          place: { x: 65, y: 42, width: 96, height: 16 },
          meta: { role: "annotation" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 40, y: 40, width: 121, height: 20 }
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('dominant-baseline="hanging"');
    expect(svg).toContain('>M6 clearance</tspan>');
  });

  it("should use effective stroke color for default annotation arrowheads", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        note: {
          id: "note",
          type: "annotation",
          text: "Check",
          leader: {
            from: { x: 10, y: 10 },
            to: { x: 30, y: 20 },
          },
          meta: { role: "annotation" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 10, y: 10, width: 20, height: 10 }
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('stroke="black"');
    expect(svg).toContain('fill="black" stroke="none"');
    expect(svg).not.toContain('fill="#888888"');
  });

  it("should keep y-up annotation text upright around its anchor", () => {
    const scene: any = {
      unit: "px",
      orientation: "y-up",
      objects: {
        note: {
          id: "note",
          type: "annotation",
          text: "tangent",
          target: "target",
          place: { x: 30, y: 20, width: 60, height: 16 },
          meta: { role: "annotation" },
        },
        target: {
          id: "target",
          type: "point",
          x: 10,
          y: 10,
          meta: {},
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 60, height: 40 },
    };

    const svg = renderToSVG(scene, { padding: 0 });
    expect(svg).toContain('transform="scale(1, -1)"');
    expect(svg).toContain(
      'transform="translate(30 20) scale(1 -1) translate(-30 -20)"',
    );
    expect(svg).toContain('>tangent</tspan>');
  });

  it("should render multiline text with tspans in top-down order", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        label: {
          id: "label",
          type: "text",
          x: 10,
          y: 20,
          width: 50,
          height: 24,
          content: "Line 1\nLine 2",
          anchor: "topLeft",
          meta: { lineHeight: 1.4 },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 10, y: 20, width: 50, height: 24 }
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('dominant-baseline="hanging"');
    expect(svg).toContain('<tspan x="10" dy="0">Line 1</tspan>');
    expect(svg).toContain('<tspan x="10" dy="1.4em">Line 2</tspan>');
  });

  it("should use effective stroke color for default dimension arrowheads", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        dim: {
          id: "dim",
          type: "dimension",
          kind: "linear",
          from: { x: 0, y: 0 },
          to: { x: 50, y: 0 },
          offset: 10,
          text: "50px",
          meta: { role: "dimension" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 50, height: 10 }
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('stroke="black"');
    expect(svg).toContain('fill="black" stroke="none"');
    expect(svg).not.toContain('fill="#888888"');
  });

  it("should render radius dimension with leader and effective stroke/fill defaults", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        hole: {
          id: "hole",
          type: "circle",
          cx: 50,
          cy: 50,
          radius: 20,
          meta: {},
        },
        dim: {
          id: "dim",
          type: "dimension",
          kind: "radius",
          target: "hole",
          text: "R20",
          meta: { role: "dimension" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 30, y: 30, width: 40, height: 40 }
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('<line x1="50" y1="50" x2="64.14213562373095" y2="64.14213562373095"');
    expect(svg).toContain('fill="black" stroke="none"');
    expect(svg).toMatch(/<path d="M 64\.14213562373095 64\.14213562373095 L [^"]+" fill="black" stroke="none" \/>/);
    expect(svg).toContain('<path d="M 64.14213562373095 64.14213562373095 L 65.94213562373095 65.94213562373095 L 70.18477631085024 65.94213562373095"');
    expect(svg).toContain('>R20</text>');
  });

  it("should render diameter dimension with double arrowheads and leader", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        hole: {
          id: "hole",
          type: "circle",
          cx: 50,
          cy: 50,
          radius: 20,
          meta: {},
        },
        dim: {
          id: "dim",
          type: "dimension",
          kind: "diameter",
          target: "hole",
          text: "D40",
          meta: { role: "dimension", stroke: "#336699", fill: "#112233" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 30, y: 30, width: 40, height: 40 }
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('<line x1="35.85786437626905" y1="35.85786437626905" x2="64.14213562373095" y2="64.14213562373095"');
    expect(svg).toContain('fill="#336699" stroke="none"');
    expect((svg.match(/fill="#336699" stroke="none"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(svg).toContain('<path d="M 64.14213562373095 64.14213562373095 L 65.94213562373095 65.94213562373095 L 70.18477631085024 65.94213562373095"');
    expect(svg).toContain('fill="#112233" stroke="none">D40</text>');
  });

  it("should place angle dimension label on normalized sweep for wraparound angles", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        lineA: {
          id: "lineA",
          type: "line",
          x1: 0,
          y1: 0,
          x2: -98.4807753012208,
          y2: 17.364817766693026,
          meta: { role: "construction" },
        },
        lineB: {
          id: "lineB",
          type: "line",
          x1: 0,
          y1: 0,
          x2: -98.4807753012208,
          y2: -17.364817766693026,
          meta: { role: "construction" },
        },
        dim: {
          id: "dim",
          type: "dimension",
          kind: "angle",
          between: ["lineA", "lineB"],
          text: "20deg",
          meta: { role: "dimension" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: -100, y: -20, width: 100, height: 40 }
    };

    const svg = renderToSVG(scene, { showConstruction: true });
    expect(svg).toContain('A 20 20 0 0 1');
    expect(svg).toMatch(/<text x="-\d/);
    expect(svg).toContain(">20deg</text>");
  });

  it("should hide invisible objects", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        ghost: {
          id: "ghost",
          type: "rect",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          meta: { visible: false },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 10, height: 10 }
    };

    const svg = renderToSVG(scene);
    expect(svg).not.toContain('id="ghost"');
  });

  it("should render arc as SVG path command", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        arc1: {
          id: "arc1",
          type: "arc",
          x1: 70,
          y1: 50,
          x2: 50,
          y2: 70,
          cx: 50,
          cy: 50,
          radius: 20,
          startAngle: 0,
          endAngle: Math.PI / 2,
          sweep: 1,
          largeArc: 0,
          meta: { stroke: "blue" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 50, y: 50, width: 20, height: 20 }
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('<path d="M 70 50 A 20 20 0 0 1 50 70"');
    expect(svg).toContain('stroke="blue"');
  });

  it("should render ellipse with optional rotation", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        oval: {
          id: "oval",
          type: "ellipse",
          cx: 50,
          cy: 30,
          rx: 20,
          ry: 10,
          rotation: Math.PI / 4,
          meta: { stroke: "green" },
        } as any,
      },
      parameters: {},
      values: {},
      bbox: { x: 30, y: 20, width: 40, height: 20 }
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('<ellipse cx="50" cy="30" rx="20" ry="10"');
    expect(svg).toContain('transform="rotate(45 50 30)"');
    expect(svg).toContain('stroke="green"');
  });

  it("should render quadratic and cubic as SVG path commands", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        q1: {
          id: "q1",
          type: "quadratic",
          x1: 0,
          y1: 0,
          cpx: 10,
          cpy: 20,
          x2: 30,
          y2: 0,
          meta: { stroke: "green" },
        },
        c1: {
          id: "c1",
          type: "cubic",
          x1: 40,
          y1: 0,
          cp1x: 50,
          cp1y: 20,
          cp2x: 60,
          cp2y: 20,
          x2: 70,
          y2: 0,
          meta: { stroke: "purple" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 70, height: 20 }
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('<path d="M 0 0 Q 10 20 30 0"');
    expect(svg).toContain('<path d="M 40 0 C 50 20 60 20 70 0"');
    expect(svg).toContain('stroke="green"');
    expect(svg).toContain('stroke="purple"');
  });

  it("should render segmented closed path as SVG path sequence", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        shape: {
          id: "shape",
          type: "path",
          closed: true,
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 40, y: 0 },
            { x: 70, y: 0 },
          ],
          segments: [
            { type: "line", x1: 0, y1: 0, x2: 20, y2: 0 },
            { type: "quadratic", x1: 20, y1: 0, cpx: 30, cpy: 10, x2: 40, y2: 0 },
            { type: "cubic", x1: 40, y1: 0, cp1x: 50, cp1y: 10, cp2x: 60, cp2y: 10, x2: 70, y2: 0 },
          ],
          meta: { stroke: "orange" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 70, height: 10 }
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('<path d="M 0 0 L 20 0 Q 30 10 40 0 C 50 10 60 10 70 0 Z"');
    expect(svg).toContain('stroke="orange"');
  });

  it("should render split result pieces as ordinary path geometry under a collection root", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        split_outline: {
          id: "split_outline",
          type: "collection",
          children: ["split_outline[0]", "split_outline[1]"],
        },
        "split_outline[0]": {
          id: "split_outline[0]",
          type: "path",
          closed: false,
          segments: [
            { type: "line", x1: 0, y1: 0, x2: 30, y2: 0 },
            { type: "quadratic", x1: 30, y1: 0, cpx: 45, cpy: 12, x2: 60, y2: 10 },
          ],
          meta: { stroke: "#2563eb" },
        },
        "split_outline[1]": {
          id: "split_outline[1]",
          type: "path",
          closed: false,
          segments: [
            { type: "quadratic", x1: 60, y1: 10, cpx: 78, cpy: 8, x2: 90, y2: 0 },
          ],
          meta: { stroke: "#dc2626" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 90, height: 12 }
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('id="split_outline"');
    expect(svg).toContain('<path d="M 0 0 L 30 0 Q 45 12 60 10"');
    expect(svg).toContain('<path d="M 60 10 Q 78 8 90 0"');
    expect(svg).toContain('stroke="#2563eb"');
    expect(svg).toContain('stroke="#dc2626"');
  });

  it("should render arc segment inside path as SVG arc command", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        shape: {
          id: "shape",
          type: "path",
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 20, y: 0 },
          ],
          segments: [
            { type: "line", x1: 0, y1: 0, x2: 0, y2: 0 },
            { type: "arc", x1: 0, y1: 0, xt: 10, yt: 10, x2: 20, y2: 0, cx: 10, cy: 0, radius: 10, sweep: 1, largeArc: 0 },
          ],
          meta: { stroke: "teal" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 20, height: 10 }
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('<path d="M 0 0 L 0 0 A 10 10 0 0 1 20 0"');
    expect(svg).toContain('stroke="teal"');
  });

  it("should wrap transformed primitive objects in a transform group", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        box: {
          id: "box",
          type: "rect",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          transform: [{ type: "translate", x: 15, y: 25 }],
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 15, y: 25, width: 10, height: 10 },
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('<g id="box.transform" transform="translate(15, 25)"><rect x="0" y="0" width="10" height="10"');
  });

  it("should prefer meta.strokeWidth over deprecated meta.width", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        box: {
          id: "box",
          type: "rect",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          meta: { stroke: "black", strokeWidth: 4, width: 2 },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 10, height: 10 },
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('stroke-width="4"');
  });

  it("should still accept deprecated meta.width as fallback stroke width", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        box: {
          id: "box",
          type: "rect",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          meta: { stroke: "black", width: 3 },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 10, height: 10 },
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('stroke-width="3"');
  });

  it("should keep visible default stroke for stroked objects without explicit strokeWidth", () => {
    const scene: ResolvedScene = {
      unit: "m",
      objects: {
        frame: {
          id: "frame",
          type: "rect",
          x: 0,
          y: 0,
          width: 8,
          height: 5,
          meta: { stroke: "#0f172a" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 8, height: 5 },
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('stroke="#0f172a"');
    expect(svg).toContain('stroke-width="0.5"');
    expect(svg).toContain('vector-effect="non-scaling-stroke"');
  });

  it("should expose resolved inspection metadata as SVG data attributes", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        mark: {
          id: "mark",
          type: "circle",
          cx: 10,
          cy: 10,
          radius: 4,
          metaPreset: "inspectionMark",
          meta: {
            role: "final",
            intent: "inspection-mark",
            label: "M1",
            stroke: "#111827",
          },
        } as any,
      },
      parameters: {},
      values: {},
      bbox: { x: 6, y: 6, width: 8, height: 8 },
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('data-role="final"');
    expect(svg).toContain('data-intent="inspection-mark"');
    expect(svg).toContain('data-meta-preset="inspectionMark"');
    expect(svg).toContain('data-label="M1"');
  });

  it("should show active DSL version in sheet title block", () => {
    const scene: ResolvedScene = {
      unit: "mm",
      objects: {
        panel: {
          id: "panel",
          type: "rect",
          x: 0,
          y: 0,
          width: 40,
          height: 20,
          meta: { role: "final" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 40, height: 20 },
      views: {
        front: {
          id: "front",
          target: "panel",
          scale: "1:1",
          scaleFactor: 1,
          objects: {
            panel: {
              id: "panel",
              type: "rect",
              x: 0,
              y: 0,
              width: 40,
              height: 20,
              meta: { role: "final" },
            },
          },
          bbox: { x: 0, y: 0, width: 40, height: 20 },
        },
      },
      sheets: {
        drawing1: {
          id: "drawing1",
          size: "A4",
          width: 297,
          height: 210,
          views: [
            {
              use: "front",
              x: 0,
              y: 0,
              width: 40,
              height: 20,
            },
          ],
          meta: {},
        },
      },
    };

    const svg = renderToSVG(scene, { sheetId: "drawing1" });
    expect(svg).toContain("RELGEO: v0.5");
  });

  it("should not inherit root document meta into regular object render metadata", () => {
    const scene: ResolvedScene = {
      unit: "px",
      meta: {
        title: "Assembly Sheet",
        version: "DOC-2026.07",
        role: "guide",
        stroke: "#94a3b8",
      } as any,
      objects: {
        box: {
          id: "box",
          type: "rect",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          meta: {},
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 10, height: 10 },
    };

    const svg = renderToSVG(scene);
    expect(svg).toContain('class="role-final"');
    expect(svg).toContain('data-role="final"');
    expect(svg).not.toContain('class="role-guide"');
    expect(svg).not.toContain('stroke="#94a3b8"');
  });

  it("should hide construction objects from final output by default", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        buildLine: {
          id: "buildLine",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 50,
          y2: 0,
          meta: { role: "construction" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 50, height: 0 },
    };

    const svg = renderToSVG(scene);
    expect(svg).not.toContain('id="buildLine"');
    expect(svg).not.toContain('class="role-construction"');
  });

  it("should allow construction objects when showConstruction is enabled", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        buildLine: {
          id: "buildLine",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 50,
          y2: 0,
          meta: { role: "construction" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 50, height: 0 },
    };

    const svg = renderToSVG(scene, { showConstruction: true });
    expect(svg).toContain('id="buildLine"');
    expect(svg).toContain('class="role-construction"');
  });

  it("should hide guide objects when showGuide is disabled", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        guideLine: {
          id: "guideLine",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 50,
          y2: 0,
          meta: { role: "guide" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 50, height: 0 },
    };

    const svg = renderToSVG(scene, { showGuide: false });
    expect(svg).not.toContain('id="guideLine"');
  });

  it("should align sheet view transform with resolved view bbox semantics", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        constructionLine: {
          id: "constructionLine",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 20,
          y2: 0,
          meta: { role: "construction" },
        },
        panel: {
          id: "panel",
          type: "rect",
          x: 100,
          y: 0,
          width: 50,
          height: 20,
          meta: { role: "final" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 100, y: 0, width: 50, height: 20 },
      views: {
        front: {
          id: "front",
          target: "panel",
          scale: "1:1",
          scaleFactor: 1,
          objects: {
            constructionLine: {
              id: "constructionLine",
              type: "line",
              x1: 0,
              y1: 0,
              x2: 20,
              y2: 0,
              meta: { role: "construction" },
            },
            panel: {
              id: "panel",
              type: "rect",
              x: 100,
              y: 0,
              width: 50,
              height: 20,
              meta: { role: "final" },
            },
          },
          bbox: { x: 100, y: 0, width: 50, height: 20 },
        },
      },
      sheets: {
        drawing1: {
          id: "drawing1",
          size: "A4",
          width: 297,
          height: 210,
          views: [
            {
              use: "front",
              x: 0,
              y: 0,
              width: 50,
              height: 20,
            },
          ],
          meta: {},
        },
      },
    };

    const svg = renderToSVG(scene, { sheetId: "drawing1" });
    expect(svg).toContain('transform="translate(0, 0) scale(1) translate(-100, 0)"');
  });

  it("should keep explicit strokeWidth non-scaling inside scaled sheet views by default", () => {
    const scene: ResolvedScene = {
      unit: "mm",
      objects: {
        panel: {
          id: "panel",
          type: "rect",
          x: 0,
          y: 0,
          width: 40,
          height: 20,
          meta: { role: "final", stroke: "#111827", strokeWidth: 2 },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 40, height: 20 },
      views: {
        detail: {
          id: "detail",
          target: "panel",
          scale: "2:1",
          scaleFactor: 2,
          objects: {
            panel: {
              id: "panel",
              type: "rect",
              x: 0,
              y: 0,
              width: 40,
              height: 20,
              meta: { role: "final", stroke: "#111827", strokeWidth: 2 },
            },
          },
          bbox: { x: 0, y: 0, width: 40, height: 20 },
        },
      },
      sheets: {
        drawing1: {
          id: "drawing1",
          size: "A4",
          width: 297,
          height: 210,
          views: [
            {
              use: "detail",
              x: 20,
              y: 30,
              width: 80,
              height: 40,
            },
          ],
          meta: {},
        },
      },
    };

    const svg = renderToSVG(scene, { sheetId: "drawing1" });
    expect(svg).toContain('transform="translate(20, 30) scale(2) translate(0, 0)"');
    expect(svg).toContain(
      'id="sheet.detail.panel" class="role-final" data-role="final" data-preview-stroke="visible" data-preview-stroke-source="explicit" stroke="#111827" fill="none" stroke-width="2" opacity="1"  vector-effect="non-scaling-stroke"'
    );
  });

  it("should compensate dimension presentational sizes inside scaled sheet views", () => {
    const scene: ResolvedScene = {
      unit: "mm",
      objects: {
        dim: {
          id: "dim",
          type: "dimension",
          kind: "linear",
          from: { x: 0, y: 0 },
          to: { x: 20, y: 0 },
          offset: 10,
          text: "20mm",
          meta: { role: "dimension", stroke: "#111827", fontSize: 6, arrowSize: 4 },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 20, height: 10 },
      views: {
        detail: {
          id: "detail",
          target: "dim",
          scale: "2:1",
          scaleFactor: 2,
          objects: {
            dim: {
              id: "dim",
              type: "dimension",
              kind: "linear",
              from: { x: 0, y: 0 },
              to: { x: 20, y: 0 },
              offset: 10,
              text: "20mm",
              meta: { role: "dimension", stroke: "#111827", fontSize: 6, arrowSize: 4 },
            },
          },
          bbox: { x: 0, y: 0, width: 20, height: 10 },
        },
      },
      sheets: {
        drawing1: {
          id: "drawing1",
          size: "A4",
          width: 297,
          height: 210,
          views: [{ use: "detail", x: 20, y: 30, width: 80, height: 40 }],
          meta: {},
        },
      },
    };

    const svg = renderToSVG(scene, { sheetId: "drawing1" });
    expect(svg).toContain('transform="translate(20, 30) scale(2) translate(0, 0)"');
    expect(svg).toContain('<line x1="0" y1="5" x2="20" y2="5" vector-effect="non-scaling-stroke" />');
    expect(svg).toContain('font-size="3px"');
  });

  it("should compensate annotation presentational sizes inside scaled sheet views", () => {
    const scene: ResolvedScene = {
      unit: "mm",
      objects: {
        note: {
          id: "note",
          type: "annotation",
          text: "Check",
          leader: {
            from: { x: 10, y: 10 },
            to: { x: 30, y: 20 },
          },
          meta: { role: "annotation", stroke: "#111827", fontSize: 8, arrowSize: 6 },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 10, y: 10, width: 20, height: 10 },
      views: {
        detail: {
          id: "detail",
          target: "note",
          scale: "2:1",
          scaleFactor: 2,
          objects: {
            note: {
              id: "note",
              type: "annotation",
              text: "Check",
              leader: {
                from: { x: 10, y: 10 },
                to: { x: 30, y: 20 },
              },
              meta: { role: "annotation", stroke: "#111827", fontSize: 8, arrowSize: 6 },
            },
          },
          bbox: { x: 10, y: 10, width: 20, height: 10 },
        },
      },
      sheets: {
        drawing1: {
          id: "drawing1",
          size: "A4",
          width: 297,
          height: 210,
          views: [{ use: "detail", x: 20, y: 30, width: 80, height: 40 }],
          meta: {},
        },
      },
    };

    const svg = renderToSVG(scene, { sheetId: "drawing1" });
    expect(svg).toContain('transform="translate(20, 30) scale(2) translate(-5, -5)"');
    expect(svg).toContain('font-size="4px"');
    expect(svg).toContain('<circle cx="10" cy="10" r="1" fill="#111827" stroke="none" />');
  });

  it("should compensate angular dimension presentational sizes inside scaled sheet views", () => {
    const scene: ResolvedScene = {
      unit: "mm",
      objects: {
        base: {
          id: "base",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 20,
          y2: 0,
          meta: { role: "final" },
        },
        side: {
          id: "side",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 20,
          meta: { role: "final" },
        },
        angle: {
          id: "angle",
          type: "dimension",
          kind: "angle",
          between: ["base", "side"],
          text: "90deg",
          meta: { role: "dimension", stroke: "#111827", fontSize: 6, arrowSize: 4 },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 20, height: 20 },
      views: {
        detail: {
          id: "detail",
          target: "angle",
          scale: "2:1",
          scaleFactor: 2,
          objects: {
            base: {
              id: "base",
              type: "line",
              x1: 0,
              y1: 0,
              x2: 20,
              y2: 0,
              meta: { role: "final" },
            },
            side: {
              id: "side",
              type: "line",
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 20,
              meta: { role: "final" },
            },
            angle: {
              id: "angle",
              type: "dimension",
              kind: "angle",
              between: ["base", "side"],
              text: "90deg",
              meta: { role: "dimension", stroke: "#111827", fontSize: 6, arrowSize: 4 },
            },
          },
          bbox: { x: 0, y: 0, width: 20, height: 20 },
        },
      },
      sheets: {
        drawing1: {
          id: "drawing1",
          size: "A4",
          width: 297,
          height: 210,
          views: [{ use: "detail", x: 20, y: 30, width: 80, height: 80 }],
          meta: {},
        },
      },
    };

    const svg = renderToSVG(scene, { sheetId: "drawing1" });
    expect(svg).toContain('transform="translate(20, 30) scale(2) translate(0, 0)"');
    expect(svg).toContain('A 10 10 0 0 1');
    expect(svg).toContain('font-size="3px"');
  });

  it("should compensate diameter dimension presentational sizes inside scaled sheet views", () => {
    const scene: ResolvedScene = {
      unit: "mm",
      objects: {
        hole: {
          id: "hole",
          type: "circle",
          cx: 20,
          cy: 20,
          radius: 10,
          meta: { role: "final" },
        },
        dim: {
          id: "dim",
          type: "dimension",
          kind: "diameter",
          target: "hole",
          text: "20mm",
          meta: { role: "dimension", stroke: "#111827", fontSize: 6, arrowSize: 4 },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 10, y: 10, width: 20, height: 20 },
      views: {
        detail: {
          id: "detail",
          target: "hole",
          scale: "2:1",
          scaleFactor: 2,
          objects: {
            hole: {
              id: "hole",
              type: "circle",
              cx: 20,
              cy: 20,
              radius: 10,
              meta: { role: "final" },
            },
            dim: {
              id: "dim",
              type: "dimension",
              kind: "diameter",
              target: "hole",
              text: "20mm",
              meta: { role: "dimension", stroke: "#111827", fontSize: 6, arrowSize: 4 },
            },
          },
          bbox: { x: 20, y: 20, width: 40, height: 40 },
        },
      },
      sheets: {
        drawing1: {
          id: "drawing1",
          size: "A4",
          width: 297,
          height: 210,
          views: [{ use: "detail", x: 20, y: 30, width: 80, height: 80 }],
          meta: {},
        },
      },
    };

    const svg = renderToSVG(scene, { sheetId: "drawing1" });
    expect(svg).toContain('transform="translate(20, 30) scale(2) translate(-10, -10)"');
    expect(svg).toContain('font-size="3px"');
    expect(svg).toContain('fill="#111827" stroke="none"');
  });

  it("should compensate text object font size inside scaled sheet views", () => {
    const scene: ResolvedScene = {
      unit: "mm",
      objects: {
        label: {
          id: "label",
          type: "text",
          x: 20,
          y: 12,
          width: 30,
          height: 10,
          content: "PLATE A",
          meta: { role: "final", fill: "#111827", fontSize: 8 },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 20, y: 12, width: 30, height: 10 },
      views: {
        detail: {
          id: "detail",
          target: "label",
          scale: "2:1",
          scaleFactor: 2,
          objects: {
            label: {
              id: "label",
              type: "text",
              x: 20,
              y: 12,
              width: 30,
              height: 10,
              content: "PLATE A",
              meta: { role: "final", fill: "#111827", fontSize: 8 },
            },
          },
          bbox: { x: 40, y: 24, width: 60, height: 20 },
        },
      },
      sheets: {
        drawing1: {
          id: "drawing1",
          size: "A4",
          width: 297,
          height: 210,
          views: [{ use: "detail", x: 20, y: 30, width: 80, height: 30 }],
          meta: {},
        },
      },
    };

    const svg = renderToSVG(scene, { sheetId: "drawing1" });
    expect(svg).toContain('transform="translate(20, 30) scale(2) translate(-20, -12)"');
    expect(svg).toContain('font-size="4"');
    expect(svg).toContain(">PLATE A</text>");
  });

  it("should compensate point marker size inside scaled sheet views", () => {
    const scene: ResolvedScene = {
      unit: "mm",
      objects: {
        mark: {
          id: "mark",
          type: "point",
          x: 20,
          y: 20,
          meta: { role: "final", pointShape: "circle", pointSize: 4, fill: "#111827" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 20, y: 20, width: 1, height: 1 },
      views: {
        detail: {
          id: "detail",
          target: "mark",
          scale: "2:1",
          scaleFactor: 2,
          objects: {
            mark: {
              id: "mark",
              type: "point",
              x: 20,
              y: 20,
              meta: { role: "final", pointShape: "circle", pointSize: 4, fill: "#111827" },
            },
          },
          bbox: { x: 40, y: 40, width: 2, height: 2 },
        },
      },
      sheets: {
        drawing1: {
          id: "drawing1",
          size: "A4",
          width: 297,
          height: 210,
          views: [{ use: "detail", x: 20, y: 30, width: 40, height: 40 }],
          meta: {},
        },
      },
    };

    const svg = renderToSVG(scene, { sheetId: "drawing1" });
    expect(svg).toContain('transform="translate(20, 30) scale(2) translate(-20, -20)"');
    expect(svg).toContain('cx="20" cy="20" r="2"');
  });

  it("should render only resolved view objects in sheet viewports", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        finalBox: {
          id: "finalBox",
          type: "rect",
          x: 0,
          y: 0,
          width: 40,
          height: 20,
          meta: { role: "final" },
        },
        guideLine: {
          id: "guideLine",
          type: "line",
          x1: 0,
          y1: 10,
          x2: 40,
          y2: 10,
          meta: { role: "guide" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 40, height: 20 },
      views: {
        front: {
          id: "front",
          target: "finalBox",
          scale: "1:1",
          scaleFactor: 1,
          objects: {
            finalBox: {
              id: "finalBox",
              type: "rect",
              x: 0,
              y: 0,
              width: 40,
              height: 20,
              meta: { role: "final" },
            },
          },
          bbox: { x: 0, y: 0, width: 40, height: 20 },
        },
      },
      sheets: {
        drawing1: {
          id: "drawing1",
          size: "A4",
          width: 297,
          height: 210,
          views: [
            {
              use: "front",
              x: 0,
              y: 0,
              width: 40,
              height: 20,
            },
          ],
          meta: {},
        },
      },
    };

    const svg = renderToSVG(scene, { sheetId: "drawing1" });
    expect(svg).toContain('id="sheet.front.finalBox"');
    expect(svg).not.toContain("guideLine");
  });

  it("should honor renderer role visibility overrides inside sheet viewports", () => {
    const scene: ResolvedScene = {
      unit: "px",
      objects: {
        finalBox: {
          id: "finalBox",
          type: "rect",
          x: 0,
          y: 0,
          width: 40,
          height: 20,
          meta: { role: "final" },
        },
        guideLine: {
          id: "guideLine",
          type: "line",
          x1: 0,
          y1: 10,
          x2: 40,
          y2: 10,
          meta: { role: "guide" },
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 40, height: 20 },
      views: {
        front: {
          id: "front",
          target: "finalBox",
          scale: "1:1",
          scaleFactor: 1,
          objects: {
            finalBox: {
              id: "finalBox",
              type: "rect",
              x: 0,
              y: 0,
              width: 40,
              height: 20,
              meta: { role: "final" },
            },
            guideLine: {
              id: "guideLine",
              type: "line",
              x1: 0,
              y1: 10,
              x2: 40,
              y2: 10,
              meta: { role: "guide" },
            },
          },
          bbox: { x: 0, y: 0, width: 40, height: 20 },
        },
      },
      sheets: {
        drawing1: {
          id: "drawing1",
          size: "A4",
          width: 297,
          height: 210,
          views: [
            {
              use: "front",
              x: 0,
              y: 0,
              width: 40,
              height: 20,
            },
          ],
          meta: {},
        },
      },
    };

    const hiddenGuideSvg = renderToSVG(scene, { sheetId: "drawing1", showGuide: false });
    expect(hiddenGuideSvg).toContain('id="sheet.front.finalBox"');
    expect(hiddenGuideSvg).not.toContain('id="sheet.front.guideLine"');

    const visibleGuideSvg = renderToSVG(scene, { sheetId: "drawing1", showGuide: true });
    expect(visibleGuideSvg).toContain('id="sheet.front.guideLine"');
    expect(visibleGuideSvg).toContain('class="role-guide"');
  });
});
