import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseRelGeo, resolveGeometry } from "@relgeo/core";
import { renderToSVG } from "../../dist/index.mjs";

function loadResolvedFixture(name: string) {
  const filePath = fileURLToPath(
    new URL(`../../../fixtures/reference/${name}`, import.meta.url),
  );
  return resolveGeometry(parseRelGeo(readFileSync(filePath, "utf8")));
}

describe("dist boundary", () => {
  it("renders sheet title block fixture through built core and renderer artifacts", () => {
    const scene = loadResolvedFixture("03-sheet-title-block.yaml");
    const svg = renderToSVG(scene, { sheetId: "drawing1" });

    expect(svg).toContain("SHEET: Assembly Sheet");
    expect(svg).toContain("RELGEO: v0.5");
    expect(svg).toContain("DATE: 2026-06-23");
    expect(svg).toContain("SIZE: A4");
    expect(svg).toContain("DOC VER: 1.2");
    expect(svg).toContain("Viewport: front");
  });
});
