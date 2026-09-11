import type {
    ResolvedRect,
    ResolvedLine,
    ResolvedCircle,
    ResolvedEllipse,
    ResolvedArc,
    ResolvedQuadratic,
    ResolvedCubic,
    ResolvedText,
    ResolvedPath,
    ResolvedPoint,
    ResolvedObject
} from "@relgeo/geometry";
import { escapeXml } from "./escape";

function extractStrokeFromCommonAttr(commonAttr: string): string | undefined {
    const match = commonAttr.match(/\sstroke="([^"]+)"/);
    return match?.[1];
}

function normalizeAngleSweep(start: number, end: number): number {
    let sweep = end - start;
    while (sweep <= -Math.PI) sweep += Math.PI * 2;
    while (sweep > Math.PI) sweep -= Math.PI * 2;
    return sweep;
}

function getPhysicalPresentationalScale(scene: any): number {
    const scale = scene?.__viewScale;
    if (scene?.__physicalPreview === true && typeof scale === "number" && Number.isFinite(scale) && scale > 0) {
        return scale;
    }
    return 1;
}

export function renderRect(obj: ResolvedRect, commonAttr: string): string {
    return `<rect x="${obj.x}" y="${obj.y}" width="${obj.width}" height="${obj.height}" ${commonAttr} />`;
}

export function renderLine(obj: ResolvedLine, commonAttr: string): string {
    return `<line x1="${obj.x1}" y1="${obj.y1}" x2="${obj.x2}" y2="${obj.y2}" ${commonAttr} />`;
}

export function renderCircle(obj: ResolvedCircle, commonAttr: string): string {
    return `<circle cx="${obj.cx}" cy="${obj.cy}" r="${obj.radius}" ${commonAttr} />`;
}

export function renderEllipse(obj: ResolvedEllipse, commonAttr: string): string {
    const rotation = obj.rotation ?? 0;
    const rotationDeg = (rotation * 180) / Math.PI;
    const transform = Math.abs(rotationDeg) > 1e-9
        ? ` transform="rotate(${rotationDeg} ${obj.cx} ${obj.cy})"`
        : "";
    return `<ellipse cx="${obj.cx}" cy="${obj.cy}" rx="${obj.rx}" ry="${obj.ry}"${transform} ${commonAttr} />`;
}

export function renderArc(obj: ResolvedArc, commonAttr: string): string {
    return `<path d="M ${obj.x1} ${obj.y1} A ${obj.radius} ${obj.radius} 0 ${obj.largeArc ?? 0} ${obj.sweep ?? 1} ${obj.x2} ${obj.y2}" ${commonAttr} />`;
}

export function renderQuadratic(obj: ResolvedQuadratic, commonAttr: string): string {
    return `<path d="M ${obj.x1} ${obj.y1} Q ${obj.cpx} ${obj.cpy} ${obj.x2} ${obj.y2}" ${commonAttr} />`;
}

export function renderCubic(obj: ResolvedCubic, commonAttr: string): string {
    return `<path d="M ${obj.x1} ${obj.y1} C ${obj.cp1x} ${obj.cp1y} ${obj.cp2x} ${obj.cp2y} ${obj.x2} ${obj.y2}" ${commonAttr} />`;
}

export function renderPoint(obj: ResolvedPoint, commonAttr: string, meta: any, scene?: any): string {
    const presentationalScale = getPhysicalPresentationalScale(scene);
    let size = meta.pointSize !== undefined ? parseFloat(meta.pointSize) : undefined;
    if (size === undefined) {
        const bbox = scene?.bbox;
        const maxDim = bbox ? Math.hypot(bbox.width, bbox.height) : 100;
        const scaleRef = maxDim > 0 ? maxDim : 100;
        size = Math.max(scaleRef * 0.01, 0.5); // 1% of max dimension, min 0.5
    }
    size = size / presentationalScale;
    
    if (meta.pointShape === "circle") {
        return `<circle cx="${obj.x}" cy="${obj.y}" r="${size}" ${commonAttr} />`;
    }
    
    const d = `M ${obj.x - size} ${obj.y} L ${obj.x + size} ${obj.y} M ${obj.x} ${obj.y - size} L ${obj.x} ${obj.y + size}`;
    return `<path d="${d}" ${commonAttr} />`;
}

export function renderText(obj: ResolvedText, commonAttr: string, scene?: any): string {
    let attrs = commonAttr;
    const presentationalScale = getPhysicalPresentationalScale(scene);
    if (!/\sfont-size=/.test(attrs)) {
        attrs += ` font-size="${12 / presentationalScale}"`;
    } else {
        attrs = attrs.replace(/\sfont-size="([^"]+)"/, (_, raw) => {
            const parsed = parseFloat(String(raw));
            if (!Number.isFinite(parsed)) return ` font-size="${raw}"`;
            return ` font-size="${parsed / presentationalScale}"`;
        });
    }
    if (!/\sfont-family=/.test(attrs)) attrs += ` font-family="sans-serif"`;
    const lines = String(obj.content ?? "").split("\n");
    const lineHeight = obj.meta?.lineHeight ?? 1;
    const lineStep = (() => {
        if (typeof lineHeight === "number") return `${lineHeight}em`;
        const parsed = parseFloat(String(lineHeight));
        return Number.isFinite(parsed) ? `${parsed}em` : "1em";
    })();

    if (lines.length <= 1) {
        return `<text x="${obj.x}" y="${obj.y}" dominant-baseline="hanging" ${attrs}>${escapeXml(obj.content)}</text>`;
    }

    const tspans = lines
        .map((line, idx) => `<tspan x="${obj.x}" dy="${idx === 0 ? "0" : lineStep}">${escapeXml(line)}</tspan>`)
        .join("");
    return `<text x="${obj.x}" y="${obj.y}" dominant-baseline="hanging" ${attrs}>${tspans}</text>`;
}

export function renderPath(obj: ResolvedPath, commonAttr: string): string {
    let d = "";
    if (obj.segments?.length) {
        d = segmentsToD(obj.segments, obj.closed);
    } else {
        const points = obj.points ?? [];
        if (points.length > 0) {
            d = `M ${points[0].x} ${points[0].y}`;
            points.slice(1).forEach((p: any) => {
                d += ` L ${p.x} ${p.y}`;
            });
            if (obj.closed) d += " Z";
        }
    }

    if (obj.holes && obj.holes.length > 0) {
        obj.holes.forEach(hole => {
            if (hole.segments.length > 0) {
                d += " " + segmentsToD(hole.segments, true);
            }
        });
    }

    const fillRule = obj.holes && obj.holes.length > 0 ? 'fill-rule="evenodd"' : '';
    return `<path d="${d}" ${fillRule} ${commonAttr} />`;
}

function segmentsToD(segments: any[], closed?: boolean): string {
    if (segments.length === 0) return "";
    const first = segments[0];
    let d = `M ${first.x1} ${first.y1}`;
    
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        // If this segment doesn't start where the last one ended, it's a new island/subpath
        if (i > 0) {
            const prev = segments[i - 1];
            if (Math.abs(segment.x1 - prev.x2) > 1e-4 || Math.abs(segment.y1 - prev.y2) > 1e-4) {
                if (closed) d += " Z";
                d += ` M ${segment.x1} ${segment.y1}`;
            }
        }

        if (segment.type === "line") {
            d += ` L ${segment.x2} ${segment.y2}`;
        } else if (segment.type === "arc") {
            d += ` A ${segment.radius} ${segment.radius} 0 ${segment.largeArc} ${segment.sweep} ${segment.x2} ${segment.y2}`;
        } else if (segment.type === "quadratic") {
            d += ` Q ${segment.cpx} ${segment.cpy} ${segment.x2} ${segment.y2}`;
        } else if (segment.type === "cubic") {
            d += ` C ${segment.cp1x} ${segment.cp1y} ${segment.cp2x} ${segment.cp2y} ${segment.x2} ${segment.y2}`;
        }
    }
    
    if (closed) d += " Z";
    return d;
}

function closedShapeToPath(obj: any): any {
    if (obj.type === "rect") {
        const segments = [
            { type: "line" as const, x1: obj.x, y1: obj.y, x2: obj.x + obj.width, y2: obj.y },
            { type: "line" as const, x1: obj.x + obj.width, y1: obj.y, x2: obj.x + obj.width, y2: obj.y + obj.height },
            { type: "line" as const, x1: obj.x + obj.width, y1: obj.y + obj.height, x2: obj.x, y2: obj.y + obj.height },
            { type: "line" as const, x1: obj.x, y1: obj.y + obj.height, x2: obj.x, y2: obj.y },
        ];
        return {
            ...obj,
            type: "path",
            segments,
            closed: true,
        };
    }
    if (obj.type === "circle") {
        const segments = [];
        const count = 64;
        for (let i = 0; i < count; i++) {
            const a1 = (i * 2 * Math.PI) / count;
            const a2 = ((i + 1) * 2 * Math.PI) / count;
            segments.push({
                type: "line" as const,
                x1: obj.cx + obj.radius * Math.cos(a1),
                y1: obj.cy + obj.radius * Math.sin(a1),
                x2: obj.cx + obj.radius * Math.cos(a2),
                y2: obj.cy + obj.radius * Math.sin(a2),
            });
        }
        return {
            ...obj,
            type: "path",
            segments,
            closed: true,
        };
    }
    if (obj.type === "ellipse") {
        const segments = [];
        const count = 64;
        const rotation = obj.rotation ?? 0;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        for (let i = 0; i < count; i++) {
            const a1 = (i * 2 * Math.PI) / count;
            const a2 = ((i + 1) * 2 * Math.PI) / count;
            const x1Local = obj.rx * Math.cos(a1);
            const y1Local = obj.ry * Math.sin(a1);
            const x2Local = obj.rx * Math.cos(a2);
            const y2Local = obj.ry * Math.sin(a2);
            segments.push({
                type: "line" as const,
                x1: obj.cx + x1Local * cos - y1Local * sin,
                y1: obj.cy + x1Local * sin + y1Local * cos,
                x2: obj.cx + x2Local * cos - y2Local * sin,
                y2: obj.cy + x2Local * sin + y2Local * cos,
            });
        }
        return {
            ...obj,
            type: "path",
            segments,
            closed: true,
        };
    }
    if (obj.type === "polygon") {
        if (obj.segments?.length) {
            return {
                ...obj,
                type: "path",
                closed: true,
            };
        }
        const segments = [];
        const pts = obj.points;
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % pts.length];
            segments.push({
                type: "line" as const,
                x1: p1.x,
                y1: p1.y,
                x2: p2.x,
                y2: p2.y,
            });
        }
        return {
            ...obj,
            type: "path",
            segments,
            closed: true,
        };
    }
    return obj;
}

export function renderDimension(obj: any, commonAttr: string, scene: any): string {
    let html = `<g ${commonAttr}>`;
    const ve = commonAttr.includes('vector-effect="non-scaling-stroke"') ? ' vector-effect="non-scaling-stroke"' : '';
    const presentationalScale = getPhysicalPresentationalScale(scene);

    const bbox = scene?.bbox;
    const maxDim = bbox ? Math.hypot(bbox.width, bbox.height) : 100;
    const scaleRef = maxDim > 0 ? maxDim : 100;

    const defArrowL = scaleRef * 0.03;
    const arrLBase = obj.meta?.arrowSize !== undefined ? parseFloat(obj.meta.arrowSize) : defArrowL;
    const arrL = arrLBase / presentationalScale;
    const arrW = arrL / 3;
    const defFontSize = Math.max(scaleRef * 0.04, 1);
    const fontSizeBase = obj.meta?.fontSize ?? defFontSize;
    const fontSize = fontSizeBase / presentationalScale;
    const textStyle = `font-size="${fontSize}px" font-family="${obj.meta?.fontFamily ?? 'sans-serif'}" fill="${obj.meta?.fill ?? '#444444'}" stroke="none"`;
    const effectiveStroke = obj.meta?.stroke ? escapeXml(obj.meta.stroke) : (extractStrokeFromCommonAttr(commonAttr) ?? "#000000");
    const arrowFill = effectiveStroke;

    if (obj.kind === "linear" && obj.from && obj.to) {
        const from = obj.from;
        const to = obj.to;
        const offsetBase = obj.offset ?? 15;
        const offset = offsetBase / presentationalScale;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const L = Math.hypot(dx, dy);
        if (L > 0) {
            const ux = dx / L;
            const uy = dy / L;
            const vx = -uy;
            const vy = ux;

            // Dimension line endpoints
            const d1x = from.x + offset * vx;
            const d1y = from.y + offset * vy;
            const d2x = to.x + offset * vx;
            const d2y = to.y + offset * vy;

            // Extension lines starting points with small gap
            const gapMag = arrL * 0.3;
            const overshootMag = arrL * 0.5;
            
            // Adjust gap if offset is too small (prevent extension line from starting after the dimension line)
            const actualGapMag = Math.min(gapMag, Math.abs(offset) * 0.5);
            
            const gap = actualGapMag * Math.sign(offset || 1);
            const extLen = offset + overshootMag * Math.sign(offset || 1);
            const e1_start_x = from.x + gap * vx;
            const e1_start_y = from.y + gap * vy;
            const e1_end_x = from.x + extLen * vx;
            const e1_end_y = from.y + extLen * vy;

            const e2_start_x = to.x + gap * vx;
            const e2_start_y = to.y + gap * vy;
            const e2_end_x = to.x + extLen * vx;
            const e2_end_y = to.y + extLen * vy;

            // Draw extension lines
            html += `<line x1="${e1_start_x}" y1="${e1_start_y}" x2="${e1_end_x}" y2="${e1_end_y}"${ve} />`;
            html += `<line x1="${e2_start_x}" y1="${e2_start_y}" x2="${e2_end_x}" y2="${e2_end_y}"${ve} />`;

            // Draw dimension line
            html += `<line x1="${d1x}" y1="${d1y}" x2="${d2x}" y2="${d2y}"${ve} />`;

            // Draw arrowheads
            const w11x = d1x + arrL * ux + arrW * vx;
            const w11y = d1y + arrL * uy + arrW * vy;
            const w12x = d1x + arrL * ux - arrW * vx;
            const w12y = d1y + arrL * uy - arrW * vy;

            const w21x = d2x - arrL * ux + arrW * vx;
            const w21y = d2y - arrL * uy + arrW * vy;
            const w22x = d2x - arrL * ux - arrW * vx;
            const w22y = d2y - arrL * uy - arrW * vy;

            html += `<path d="M ${d1x} ${d1y} L ${w11x} ${w11y} L ${w12x} ${w12y} Z" fill="${arrowFill}" stroke="none" />`;
            html += `<path d="M ${d2x} ${d2y} L ${w21x} ${w21y} L ${w22x} ${w22y} Z" fill="${arrowFill}" stroke="none" />`;

            // Draw label
            const cx = (d1x + d2x) / 2;
            const cy = (d1y + d2y) / 2;
            let theta = Math.atan2(dy, dx) * 180 / Math.PI;
            if (theta > 90 || theta < -90) {
                theta += 180;
            }

            html += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" transform="rotate(${theta}, ${cx}, ${cy}) translate(0, -${arrL})" ${textStyle}>${escapeXml(obj.text)}</text>`;
        }
    } else if ((obj.kind === "radius" || obj.kind === "diameter") && obj.target && scene?.objects?.[obj.target]) {
        const targetObj = scene.objects[obj.target];
        const cx = targetObj.cx ?? targetObj.center?.x ?? 0;
        const cy = targetObj.cy ?? targetObj.center?.y ?? 0;
        const r = targetObj.radius ?? targetObj.r ?? 20;

        const angleRad = 45 * Math.PI / 180;
        const ux = Math.cos(angleRad);
        const uy = Math.sin(angleRad);
        const vx = -uy;
        const vy = ux;

        const px = cx + r * ux;
        const py = cy + r * uy;

        if (obj.kind === "radius") {
            html += `<line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}"${ve} />`;
            const w1x = px - arrL * ux + arrW * vx;
            const w1y = py - arrL * uy + arrW * vy;
            const w2x = px - arrL * ux - arrW * vx;
            const w2y = py - arrL * uy - arrW * vy;
            html += `<path d="M ${px} ${py} L ${w1x} ${w1y} L ${w2x} ${w2y} Z" fill="${arrowFill}" stroke="none" />`;

            const ex = px + arrL * 1.5 * ux;
            const ey = py + arrL * 1.5 * uy;
            const sx = ex + arrL * 2.5;
            const sy = ey;
            html += `<path d="M ${px} ${py} L ${ex} ${ey} L ${sx} ${sy}" fill="none"${ve} />`;
            html += `<text x="${sx + arrL * 0.3}" y="${sy}" dominant-baseline="central" ${textStyle}>${escapeXml(obj.text)}</text>`;
        } else {
            const p2x = cx - r * ux;
            const p2y = cy - r * uy;
            html += `<line x1="${p2x}" y1="${p2y}" x2="${px}" y2="${py}"${ve} />`;

            const w1x = px - arrL * ux + arrW * vx;
            const w1y = py - arrL * uy + arrW * vy;
            const w2x = px - arrL * ux - arrW * vx;
            const w2y = py - arrL * uy - arrW * vy;
            html += `<path d="M ${px} ${py} L ${w1x} ${w1y} L ${w2x} ${w2y} Z" fill="${arrowFill}" stroke="none" />`;

            const w3x = p2x + arrL * ux + arrW * vx;
            const w3y = p2y + arrL * uy + arrW * vy;
            const w4x = p2x + arrL * ux - arrW * vx;
            const w4y = p2y + arrL * uy - arrW * vy;
            html += `<path d="M ${p2x} ${p2y} L ${w3x} ${w3y} L ${w4x} ${w4y} Z" fill="${arrowFill}" stroke="none" />`;

            const ex = px + arrL * 1.5 * ux;
            const ey = py + arrL * 1.5 * uy;
            const sx = ex + arrL * 2.5;
            const sy = ey;
            html += `<path d="M ${px} ${py} L ${ex} ${ey} L ${sx} ${sy}" fill="none"${ve} />`;
            html += `<text x="${sx + arrL * 0.3}" y="${sy}" dominant-baseline="central" ${textStyle}>${escapeXml(obj.text)}</text>`;
        }
    } else if (obj.kind === "angle" && obj.between && obj.between.length === 2 && scene?.objects?.[obj.between[0]]) {
        const line1 = scene.objects[obj.between[0]];
        const line2 = scene.objects[obj.between[1]];

        const x1_1 = line1.x1 ?? 0;
        const y1_1 = line1.y1 ?? 0;
        const x2_1 = line1.x2 ?? 0;
        const y2_1 = line1.y2 ?? 0;

        const x1_2 = line2.x1 ?? 0;
        const y1_2 = line2.y1 ?? 0;
        const x2_2 = line2.x2 ?? 0;
        const y2_2 = line2.y2 ?? 0;

        const a1 = Math.atan2(y2_1 - y1_1, x2_1 - x1_1);
        const a2 = Math.atan2(y2_2 - y1_2, x2_2 - x1_2);

        const ix = x1_1;
        const iy = y1_1;
        const R = Math.max(scaleRef * 0.1, 20) / presentationalScale;

        const x_start = ix + R * Math.cos(a1);
        const y_start = iy + R * Math.sin(a1);
        const x_end = ix + R * Math.cos(a2);
        const y_end = iy + R * Math.sin(a2);
        const sweep = normalizeAngleSweep(a1, a2);
        const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
        const sweepFlag = sweep >= 0 ? 1 : 0;

        html += `<path d="M ${x_start} ${y_start} A ${R} ${R} 0 ${largeArc} ${sweepFlag} ${x_end} ${y_end}" fill="none"${ve} />`;

        const midA = a1 + sweep / 2;
        const tx = ix + (R + arrL * 1.5) * Math.cos(midA);
        const ty = iy + (R + arrL * 1.5) * Math.sin(midA);
        html += `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" ${textStyle}>${escapeXml(obj.text)}</text>`;
    }
    html += "</g>";
    return html;
}

export function renderAnnotation(obj: any, commonAttr: string, scene: any): string {
    let html = `<g ${commonAttr}>`;
    const ve = commonAttr.includes('vector-effect="non-scaling-stroke"') ? ' vector-effect="non-scaling-stroke"' : '';
    const effectiveStroke = obj.meta?.stroke ? escapeXml(obj.meta.stroke) : (extractStrokeFromCommonAttr(commonAttr) ?? "#000000");
    const arrowFill = effectiveStroke;
    const presentationalScale = getPhysicalPresentationalScale(scene);

    const bbox = scene?.bbox;
    const maxDim = bbox ? Math.hypot(bbox.width, bbox.height) : 100;
    const scaleRef = maxDim > 0 ? maxDim : 100;

    const defArrowL = scaleRef * 0.03;
    const arrLBase = obj.meta?.arrowSize !== undefined ? parseFloat(obj.meta.arrowSize) : defArrowL;
    const arrL = arrLBase / presentationalScale;
    const arrW = arrL / 3;
    const defFontSize = Math.max(scaleRef * 0.04, 1);
    const fontSizeBase = obj.meta?.fontSize ?? defFontSize;
    const fontSize = fontSizeBase / presentationalScale;
    const textOrientationTransform = (x: number, y: number) =>
        scene?.orientation === "y-up"
            ? ` transform="translate(${x} ${y}) scale(1 -1) translate(${-x} ${-y})"`
            : "";
    if (obj.leader) {
        const from = obj.leader.from;
        const to = obj.leader.to;
        const dx = from.x - to.x;
        const dy = from.y - to.y;
        const len = Math.hypot(dx, dy);
        let arrowPath = "";
        if (len > 0) {
            const ux = dx / len;
            const uy = dy / len;
            const vx = -uy;
            const vy = ux;
            const w1x = from.x - arrL * ux + arrW * vx;
            const w1y = from.y - arrL * uy + arrW * vy;
            const w2x = from.x - arrL * ux - arrW * vx;
            const w2y = from.y - arrL * uy - arrW * vy;
            arrowPath = `<path d="M ${from.x} ${from.y} L ${w1x} ${w1y} L ${w2x} ${w2y} Z" fill="${arrowFill}" stroke="none" />`;
        }
        const text = String(obj.text || "");
        const lines = text.split("\n");
        const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
        const approxTextWidth = longestLine * fontSize * 0.6;
        const gap = 4 / presentationalScale;
        const isLeft = to.x < from.x;
        const accentEndX = isLeft ? to.x - approxTextWidth - gap : to.x + approxTextWidth + gap;
        const textX = isLeft ? to.x - approxTextWidth - gap : to.x + gap;

        html += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"${ve} />`;
        html += `<circle cx="${from.x}" cy="${from.y}" r="${2 / presentationalScale}" fill="${effectiveStroke}" stroke="none" />`;
        html += arrowPath;
        const fontFam = obj.meta?.fontFamily ?? "sans-serif";
        const fill = obj.meta?.fill ?? "#333333";
        html += `<line x1="${to.x}" y1="${to.y}" x2="${accentEndX}" y2="${to.y}"${ve} />`;
        html += `<text${textOrientationTransform(textX, to.y)} x="${textX}" y="${to.y}" dominant-baseline="hanging" font-size="${fontSize}px" font-family="${fontFam}" fill="${fill}">`;
        lines.forEach((line: string, idx: number) => {
            html += `<tspan x="${textX}" dy="${idx === 0 ? 0 : '1.2em'}">${escapeXml(line)}</tspan>`;
        });
        html += `</text>`;
    } else {
        const place = obj.place || null;
        if (place) {
            const x = place.x;
            const y = place.y;
            const lines = (obj.text || "").split("\n");
            const fontFam = obj.meta?.fontFamily ?? "sans-serif";
            const fill = obj.meta?.fill ?? "#333333";
            
            html += `<text${textOrientationTransform(x, y)} x="${x}" y="${y}" dominant-baseline="hanging" font-size="${fontSize}px" font-family="${fontFam}" fill="${fill}">`;
            lines.forEach((line: string, idx: number) => {
                html += `<tspan x="${x}" dy="${idx === 0 ? 0 : '1.2em'}">${escapeXml(line)}</tspan>`;
            });
            html += `</text>`;
        }
    }
    html += "</g>";
    return html;
}

export function renderPrimitive(obj: ResolvedObject, commonAttr: string, meta: any, scene?: any): string {
    if (["rect", "circle", "ellipse", "polygon"].includes(obj.type) && (obj as any).holes?.length) {
        return renderPath(closedShapeToPath(obj), commonAttr);
    }

    switch (obj.type) {
        case "rect": return renderRect(obj, commonAttr);
        case "line": return renderLine(obj, commonAttr);
        case "circle": return renderCircle(obj, commonAttr);
        case "ellipse": return renderEllipse(obj, commonAttr);
        case "arc": return renderArc(obj, commonAttr);
        case "quadratic": return renderQuadratic(obj, commonAttr);
        case "cubic": return renderCubic(obj, commonAttr);
        case "point": return renderPoint(obj, commonAttr, meta, scene);
        case "text": return renderText(obj, commonAttr, scene);
        case "path": return renderPath(obj, commonAttr);
        case "boolean": return renderPath({ ...obj, type: "path", closed: true }, commonAttr);
        case "dimension": return renderDimension(obj, commonAttr, scene);
        case "annotation": return renderAnnotation(obj, commonAttr, scene);
        case "polygon":
            if (obj.segments?.length) {
                return renderPath({ ...obj, type: "path", closed: true }, commonAttr);
            }
            return `<polygon points="${obj.points.map((p: any) => `${p.x},${p.y}`).join(" ")}" ${commonAttr} />`;
        default: return "";
    }
}
