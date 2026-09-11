import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseRelGeo, resolveGeometry } from "../../../core/src";
import { renderToSVG } from "../index";

function loadResolvedFixture(name: string) {
  const filePath = fileURLToPath(new URL(`../../../fixtures/reference/${name}`, import.meta.url));
  return resolveGeometry(parseRelGeo(readFileSync(filePath, "utf8")));
}

describe("reference fixtures", () => {
  it("renders mixed presentational sheet fixture from shared reference folder", () => {
    const scene = loadResolvedFixture("02-mixed-presentational-sheet.yaml");
    const svg = renderToSVG(scene, { sheetId: "drawing1" });

    expect(svg).toContain('SHEET: drawing1');
    expect(svg).toContain('>FACE A</tspan>');
    expect(svg).toContain('>CHECK</tspan>');
    expect(svg).toContain('<circle cx="140" cy="55" r="2"');
    expect(svg).toContain('>EDGE</tspan>');
    expect(svg).toContain('>BREAK</tspan>');
    expect(svg).toContain('transform="rotate(');
    expect(svg).toContain('>120mm</text>');
  });

  it("renders sheet title block fixture from shared reference folder", () => {
    const scene = loadResolvedFixture("03-sheet-title-block.yaml");
    const svg = renderToSVG(scene, { sheetId: "drawing1" });

    expect(svg).toContain("SHEET: Assembly Sheet");
    expect(svg).toContain("RELGEO: v0.5");
    expect(svg).toContain("DATE: 2026-06-23");
    expect(svg).toContain("SIZE: A4");
    expect(svg).toContain("DOC VER: 1.2");
    expect(svg).toContain("Viewport: front");
  });

  it("renders grouped sheet rooting fixture from shared reference folder", () => {
    const scene = loadResolvedFixture("04-grouped-sheet-rooting.yaml");
    const svg = renderToSVG(scene, { sheetId: "drawing1" });

    const rectMatch = svg.match(/<rect x="10" y="20" width="100" height="50"/g) ?? [];
    expect(rectMatch).toHaveLength(1);
    expect(svg).toContain('stroke="#ff0000"');
  });

  it("renders clone sheet target fixture from shared reference folder", () => {
    const scene = loadResolvedFixture("05-clone-sheet-target.yaml");
    const svg = renderToSVG(scene, { sheetId: "drawing1" });

    const rectMatch = svg.match(/<rect x="0" y="0" width="100" height="50"/g) ?? [];
    expect(rectMatch).toHaveLength(1);
    expect(svg).toContain('id="sheet.cloneView.shifted"');
    expect(svg).toContain('transform="translate(200, 0)"');
    expect(svg).toContain('stroke="#00aa88"');
  });

  it("renders nested structural sheet fixture from shared reference folder", () => {
    const scene = loadResolvedFixture("06-nested-structural-sheet.yaml");
    const svg = renderToSVG(scene, { sheetId: "drawing1" });

    const rectMatch = svg.match(/<rect x="30" y="20" width="90" height="40"/g) ?? [];
    expect(rectMatch).toHaveLength(1);
    expect(svg).toContain('stroke="#aa5500"');
    expect(svg).toContain('<line x1="90" y1="50" x2="145" y2="70"');
    expect(svg).toContain('<circle cx="90" cy="50" r="2" fill="#aa5500"');
    expect(svg).toContain('<tspan x="149" dy="0">FACE B</tspan>');
  });

  it("renders component sheet meta override fixture from shared reference folder", () => {
    const scene = loadResolvedFixture("07-component-sheet-meta-override.yaml");
    const svg = renderToSVG(scene, { sheetId: "drawing1" });

    expect(svg).toContain('stroke="#2244ff"');
    expect(svg).toContain('<rect x="40" y="15" width="80" height="30"');
    expect(svg).toContain('id="sheet.componentView.inst.shape.transform"');
  });

  it("renders sheet xml escaping fixture from shared reference folder", () => {
    const scene = loadResolvedFixture("08-sheet-xml-escaping.yaml");
    const svg = renderToSVG(scene, { sheetId: "drawing1" });

    expect(svg).toContain("A&amp;B &lt;main&gt;");
    expect(svg).toContain("SHEET: Assembly &lt;A&amp;B&gt;");
    expect(svg).toContain("RELGEO: v0.5");
    expect(svg).toContain("DOC VER: 1&lt;2&amp;3&gt;");
    expect(svg).toContain("front&amp;detail (Scale 1&lt;2)");
  });

  it("renders multi-sheet title block fixture from shared reference folder", () => {
    const scene = loadResolvedFixture("09-multi-sheet-title-block.yaml");
    const sheetA = renderToSVG(scene, { sheetId: "sheetA" });
    const sheetB = renderToSVG(scene, { sheetId: "sheetB" });

    expect(sheetA).toContain("SHEET: Bracket Assembly Sheet");
    expect(sheetA).toContain("DATE: 2026-07-13");
    expect(sheetA).toContain("DOC VER: BRKT-2026.07");
    expect(sheetA).toContain("SIZE: A4 Landscape");
    expect(sheetA).toContain("Viewport: front");

    expect(sheetB).toContain("SHEET: Bracket Detail Sheet");
    expect(sheetB).toContain("DATE: 2026-07-14");
    expect(sheetB).toContain("DOC VER: BRKT-DET-02");
    expect(sheetB).toContain("SIZE: A4 Detail");
    expect(sheetB).toContain("Viewport: detail");
    expect(sheetB).toContain('transform="translate(40, 45) scale(2) translate(0, 0)"');
  });
});
