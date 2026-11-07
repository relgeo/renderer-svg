import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseRelGeo, resolveGeometry } from "@relgeo/core";
import { getCommonAttributes } from "../utils";
import { renderAnnotation, renderDimension, renderPoint, renderText } from "../primitives";
import { renderToSVG } from "../index";

describe("SVG Security", () => {
  it("should escape special characters in common attributes", () => {
    const meta = {
      stroke: '"><script>alert(1)</script><circle "',
      fill: "red",
      width: 2,
      fontFamily: '"><path d="M0,0 L10,10" />'
    };
    const attr = getCommonAttributes("obj1", meta);
    
    expect(attr).not.toContain('"><script>');
    expect(attr).toContain('stroke="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;circle &quot;"');
    expect(attr).toContain('font-family="&quot;&gt;&lt;path d=&quot;M0,0 L10,10&quot; /&gt;"');
  });

  it("should escape text content", () => {
    const textObj: any = {
      x: 10,
      y: 20,
      content: "Hello <script>alert(1)</script>"
    };
    const rendered = renderText(textObj, "");
    expect(rendered).toContain("&lt;script&gt;");
    expect(rendered).not.toContain("<script>");
  });

  it("should inject spec default text typography when metadata is absent", () => {
    const textObj: any = {
      x: 10,
      y: 20,
      content: "Hello",
    };
    const rendered = renderText(
      textObj,
      'id="plain" class="role-final" stroke="none" fill="#000000" stroke-width="0.5" opacity="1"  vector-effect="non-scaling-stroke"',
    );
    expect(rendered).toContain('font-size="12"');
    expect(rendered).toContain('font-family="sans-serif"');
    expect(rendered).toContain('dominant-baseline="hanging"');
  });

  it("should use finite presentation fallbacks instead of serializing invalid numbers", () => {
    const common = getCommonAttributes("invalid", {
      stroke: "#111",
      opacity: "not-a-number",
      strokeWidth: "Infinity",
      fontSize: "NaN",
    });
    const text = renderText(
      { x: 0, y: 0, content: "safe", meta: { lineHeight: "NaN" } } as any,
      common,
    );
    const point = renderPoint(
      { x: 0, y: 0 } as any,
      common,
      { pointSize: "Infinity" },
      { bbox: { x: 0, y: 0, width: 10, height: 10 } },
    );
    const dimension = renderDimension(
      {
        kind: "linear",
        from: { x: 0, y: 0 },
        to: { x: 20, y: 0 },
        offset: "NaN",
        text: "safe",
        meta: { arrowSize: "Infinity", fontSize: "NaN" },
      },
      common,
      { bbox: { x: 0, y: 0, width: 20, height: 20 } },
    );

    for (const output of [common, text, point, dimension]) {
      expect(output).not.toMatch(/(?:NaN|Infinity)/);
    }
    expect(text).toContain('font-size="12"');
  });

  it("should escape dimension presentation attributes and label text", () => {
    const dimension = renderDimension(
      {
        kind: "linear",
        from: { x: 0, y: 0 },
        to: { x: 20, y: 0 },
        text: "<script>alert(1)</script>",
        meta: {
          fontFamily: '"><script>alert(2)</script><text "',
          fill: '"/><script>alert(3)</script><text "',
        },
      },
      'id="dimension"',
      { bbox: { x: 0, y: 0, width: 20, height: 20 } },
    );

    expect(dimension).not.toContain("<script>");
    expect(dimension).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(dimension).toContain('font-family="&quot;&gt;&lt;script&gt;alert(2)&lt;/script&gt;&lt;text &quot;"');
    expect(dimension).toContain('fill="&quot;/&gt;&lt;script&gt;alert(3)&lt;/script&gt;&lt;text &quot;"');
  });

  it("should escape annotation presentation attributes and leader text", () => {
    const annotation = renderAnnotation(
      {
        text: "<script>alert(4)</script>",
        leader: { from: { x: 0, y: 0 }, to: { x: 10, y: 10 } },
        meta: {
          fontFamily: '"><script>alert(5)</script><text "',
          fill: '"/><script>alert(6)</script><text "',
        },
      },
      'id="annotation"',
      { bbox: { x: 0, y: 0, width: 20, height: 20 } },
    );

    expect(annotation).not.toContain("<script>");
    expect(annotation).toContain("&lt;script&gt;alert(4)&lt;/script&gt;");
    expect(annotation).toContain('font-family="&quot;&gt;&lt;script&gt;alert(5)&lt;/script&gt;&lt;text &quot;"');
    expect(annotation).toContain('fill="&quot;/&gt;&lt;script&gt;alert(6)&lt;/script&gt;&lt;text &quot;"');
  });

  it("should keep the v0.5 presentation escaping fixture free of executable markup", () => {
    const fixturePath = fileURLToPath(new URL("./fixtures/v05-presentation-escaping.yaml", import.meta.url));
    const scene = resolveGeometry(parseRelGeo(readFileSync(fixturePath, "utf8")));
    const svg = renderToSVG(scene);

    expect(svg).not.toContain("<script>");
    expect(svg).not.toMatch(/(?:onload=|onerror=|<foreignObject)/i);
    expect(svg).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(svg).toContain("&lt;script&gt;alert(4)&lt;/script&gt;");
    expect(svg).toContain("&lt;script&gt;alert(2)&lt;/script&gt;");
    expect(svg).toContain("&lt;script&gt;alert(5)&lt;/script&gt;");
  });

  it("keeps hostile group opacity and violation labels inside data boundaries", () => {
    const scene: any = {
      unit: "px",
      objects: {
        group: {
          id: "group",
          type: "group",
          children: ["line"],
          meta: { opacity: '"><script>alert(7)</script>' },
        },
        line: {
          id: "line",
          type: "line",
          x1: 0,
          y1: 0,
          x2: 10,
          y2: 0,
          meta: {},
        },
      },
      parameters: {},
      values: {},
      bbox: { x: 0, y: 0, width: 10, height: 1 },
      violations: [{
        type: '"><script>alert(8)</script>',
        visualHelper: { x1: 0, y1: 0, x2: 1, y2: 1 },
      }],
    };

    const svg = renderToSVG(scene);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain('opacity="1"');
    expect(svg).toContain("&quot;&gt;&lt;script&gt;alert(8)&lt;/script&gt;");
  });
});
