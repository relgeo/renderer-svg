import { describe, it, expect } from "vitest";
import { getCommonAttributes } from "../utils";
import { renderText } from "../primitives";

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
});
