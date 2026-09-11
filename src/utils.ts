import type { ResolvedObject, ResolvedTransform } from "@relgeo/geometry";
import { escapeXml } from "./escape";
import type { RenderOptions } from "./types";

export function getMetadataAttributes(meta: any, obj?: ResolvedObject): string {
    const attrs: string[] = [];
    const role = meta.role || "final";
    attrs.push(`data-role="${escapeXml(role)}"`);

    if (meta.intent !== undefined) {
        attrs.push(`data-intent="${escapeXml(meta.intent)}"`);
    }

    const presetName = (obj as any)?.metaPreset ?? (obj as any)?.style;
    if (typeof presetName === "string" && presetName.length > 0) {
        attrs.push(`data-meta-preset="${escapeXml(presetName)}"`);
    }

    if (meta.label !== undefined) {
        attrs.push(`data-label="${escapeXml(String(meta.label))}"`);
    }

    return attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
}

export function getCommonAttributes(id: string, meta: any, options: RenderOptions = {}, objType?: string, scene?: any, obj?: ResolvedObject): string {
    let strokeColor = meta.stroke;
    let dashStyle = meta.dash;
    let fillMode = meta.fill;
    const explicitStrokeWidth = meta.strokeWidth ?? meta.width;
    
    const role = meta.role || "final";
    let isNakedFinal = false;

    if (role === "centerline") {
        strokeColor = strokeColor ?? "red";
        dashStyle = dashStyle ?? "12, 3, 3, 3";
        fillMode = fillMode ?? "none";
    } else if (role === "hidden") {
        strokeColor = strokeColor ?? "#555555";
        dashStyle = dashStyle ?? "6, 4";
        fillMode = fillMode ?? "none";
    } else if (role === "guide" || role === "construction") {
        strokeColor = strokeColor ?? "#3b82f6";
        dashStyle = dashStyle ?? "2, 2";
        fillMode = fillMode ?? "none";
    } else if (objType === "text") {
        if (meta.stroke === undefined && meta.fill === undefined) {
            strokeColor = "none";
            fillMode = "#000000";
        } else if (meta.stroke === undefined && meta.fill !== undefined) {
            strokeColor = "none";
        } else if (meta.stroke !== undefined && meta.fill === undefined) {
            fillMode = "none";
        }
    } else if (objType === "point") {
        if (meta.pointShape === "circle") {
            if (meta.stroke === undefined && meta.fill === undefined) {
                strokeColor = "none";
                fillMode = "#000000"; // default solid dot
            } else if (meta.stroke !== undefined && meta.fill === undefined) {
                fillMode = "none";
            } else if (meta.stroke === undefined && meta.fill !== undefined) {
                strokeColor = "none";
            }
        } else {
            if (meta.stroke === undefined && meta.fill === undefined) {
                strokeColor = "black";
                fillMode = "none";
            } else if (meta.stroke !== undefined && meta.fill === undefined) {
                fillMode = "none";
            } else if (meta.stroke === undefined && meta.fill !== undefined) {
                strokeColor = "none";
            }
        }
    } else {
        if (meta.stroke === undefined && meta.fill === undefined) {
            strokeColor = "black";
            fillMode = "none";
            if (role === "final") isNakedFinal = true;
        } else if (meta.stroke === undefined && meta.fill !== undefined) {
            strokeColor = "none";
        } else if (meta.stroke !== undefined && meta.fill === undefined) {
            fillMode = "none";
        }
    }

    const stroke = escapeXml(strokeColor);
    const fill = escapeXml(fillMode);
    const opacity = escapeXml(meta.opacity ?? 1);
    const dash = dashStyle ? `stroke-dasharray="${escapeXml(dashStyle)}"` : "";

    let fontAttrs = "";
    if (meta.fontSize !== undefined) fontAttrs += ` font-size="${escapeXml(meta.fontSize)}"`;
    if (meta.fontFamily !== undefined) fontAttrs += ` font-family="${escapeXml(meta.fontFamily)}"`;
    if (meta.fontWeight !== undefined) fontAttrs += ` font-weight="${escapeXml(meta.fontWeight)}"`;
    if (meta.fontStyle !== undefined) fontAttrs += ` font-style="${escapeXml(meta.fontStyle)}"`;

    const roleClass = `role-${escapeXml(meta.role || "final")}`;

    const globalHairline = options.hairline ?? false;
    const globalNonScaling = options.nonScalingStroke ?? (options.physicalMode ? false : true);
    const allowAutoNonScaling = options.nonScalingStroke !== false;
    const hairlineWidth = options.hairlineWidth ?? 0.5;

    let isHairline = globalHairline;
    let isNonScaling = globalHairline || globalNonScaling;
    const hasVisibleStroke = strokeColor !== undefined && strokeColor !== "none";

    if (meta["non-scaling-stroke"] !== undefined) {
      isNonScaling = !!meta["non-scaling-stroke"];
    }

    if (meta.hairline !== undefined) {
      isHairline = !!meta.hairline;
      if (isHairline && allowAutoNonScaling) isNonScaling = true;
    } else if (!globalHairline) {
      if (isNakedFinal) {
        isHairline = true;
        if (allowAutoNonScaling) isNonScaling = true;
      } else if (hasVisibleStroke && explicitStrokeWidth === undefined) {
        isHairline = true;
        if (allowAutoNonScaling) isNonScaling = true;
      }
    }

    let resolvedWidth = explicitStrokeWidth;
    if (isHairline) {
      resolvedWidth = hairlineWidth;
    } else if (resolvedWidth === undefined) {
      resolvedWidth = 1;
    }
    const strokeWidth = escapeXml(resolvedWidth);
    const vectorEffect = isNonScaling ? ` vector-effect="non-scaling-stroke"` : "";
    const metadataAttrs = getMetadataAttributes(meta, obj);
    const previewStrokeAttrs = hasVisibleStroke
      ? ` data-preview-stroke="visible" data-preview-stroke-source="${explicitStrokeWidth !== undefined ? "explicit" : "default"}"`
      : ` data-preview-stroke="none"`;

    return `id="${escapeXml(id)}" class="${roleClass}"${metadataAttrs}${previewStrokeAttrs} stroke="${stroke}" fill="${fill}" stroke-width="${strokeWidth}" opacity="${opacity}" ${dash}${fontAttrs}${vectorEffect}`;
}

export function getTransformString(transform: ResolvedTransform): string {
    const parts: string[] = [];
    for (const op of transform) {
        if (op.type === "translate") {
            parts.push(`translate(${op.x}, ${op.y})`);
        } else if (op.type === "rotate") {
            const { angle, origin } = op;
            parts.push(`rotate(${angle}, ${origin.x}, ${origin.y})`);
        } else if (op.type === "scale") {
            const { factor, origin } = op;
            parts.push(`translate(${origin.x}, ${origin.y}) scale(${factor[0]}, ${factor[1]}) translate(${-origin.x}, ${-origin.y})`);
        } else if (op.type === "mirror") {
            const { axis, origin } = op;
            const ox = origin.x;
            const oy = origin.y;
            if (axis === "x") {
                parts.push(`translate(${ox}, 0) scale(-1, 1) translate(${-ox}, 0)`);
            } else if (axis === "y") {
                parts.push(`translate(0, ${oy}) scale(1, -1) translate(0, ${-oy})`);
            } else if (axis === "both") {
                parts.push(`translate(${ox}, ${oy}) scale(-1, -1) translate(${-ox}, ${-oy})`);
            }
        }
    }
    return parts.length > 0 ? `transform="${parts.join(" ")}"` : "";
}

export function renderAnchors(obj: ResolvedObject, scene?: any): string {
    const anchors: { x: number, y: number, name: string }[] = [];
    if (obj.type === "rect") {
      anchors.push({ x: obj.x, y: obj.y, name: "topLeft" });
      anchors.push({ x: obj.x + obj.width, y: obj.y, name: "topRight" });
      anchors.push({ x: obj.x, y: obj.y + obj.height, name: "bottomLeft" });
      anchors.push({ x: obj.x + obj.width, y: obj.y + obj.height, name: "bottomRight" });
      anchors.push({ x: obj.x + obj.width / 2, y: obj.y + obj.height / 2, name: "center" });
    } else if (obj.type === "line") {
      anchors.push({ x: obj.x1, y: obj.y1, name: "start" });
      anchors.push({ x: obj.x2, y: obj.y2, name: "end" });
      anchors.push({ x: (obj.x1 + obj.x2) / 2, y: (obj.y1 + obj.y2) / 2, name: "center" });
    } else if (obj.type === "circle") {
      anchors.push({ x: obj.cx, y: obj.cy, name: "center" });
    } else if (obj.type === "point") {
      anchors.push({ x: obj.x, y: obj.y, name: "center" });
    }

    if (obj.anchors) {
      for (const [name, pos] of Object.entries(obj.anchors)) {
        anchors.push({ x: pos.x, y: pos.y, name });
      }
    }

    const bbox = scene?.bbox;
    const maxDim = bbox ? Math.hypot(bbox.width, bbox.height) : 100;
    const scaleRef = maxDim > 0 ? maxDim : 100;
    const r = Math.max(scaleRef * 0.005, 0.5);
    const strokeW = Math.max(scaleRef * 0.0016, 0.2);

    let result = anchors.map(a => 
      `<circle cx="${a.x}" cy="${a.y}" r="${r}" fill="rgba(255, 126, 0, 0.4)" stroke="#ff7e00" stroke-width="${strokeW}" vector-effect="non-scaling-stroke">
         <title>${escapeXml(obj.id)}.${escapeXml(a.name)}</title>
       </circle>`
    ).join("");

    // Draw local frame at [0,0] (which is the object's origin in local space)
    const axesLen = Math.max(scaleRef * 0.03, 3);
    const axesStrokeW = Math.max(scaleRef * 0.003, 0.3);
    result += `
    <g>
       <path d="M 0 0 L ${axesLen} 0" stroke="red" stroke-width="${axesStrokeW}" marker-end="url(#arrow-red)" vector-effect="non-scaling-stroke"/>
       <path d="M 0 0 L 0 ${axesLen}" stroke="green" stroke-width="${axesStrokeW}" marker-end="url(#arrow-green)" vector-effect="non-scaling-stroke"/>
       <title>${escapeXml(obj.id)} Local Frame</title>
    </g>`;

    return result;
}
