import { ResolvedScene, ResolvedObject, calculateBoundingBox, TECHNICAL_ROLES, TechnicalRole } from "relgeo-geometry";
import { Renderer, RenderOptions } from "./types";
import { renderPrimitive } from "./primitives";
import { getCommonAttributes, getMetadataAttributes, getTransformString, renderAnchors } from "./utils";
import { escapeXml } from "./escape";

const ACTIVE_REL_GEO_VERSION = "0.5";

export * from "./types";
export * from "./escape";
export * from "./utils";
export * from "./primitives";

export class SVGRenderer implements Renderer<string> {
  private renderedIds = new Set<string>();
  private debugElements: string[] = [];
  private options: RenderOptions = {};

  private shouldRenderRole(role: string | undefined): boolean {
    const resolvedRole = role ?? "final";
    if (resolvedRole === "construction") {
      return this.options.showConstruction === true;
    }

    if (TECHNICAL_ROLES.includes(resolvedRole as TechnicalRole)) {
      const optionKey = `show${resolvedRole.charAt(0).toUpperCase() + resolvedRole.slice(1)}` as keyof RenderOptions;
      if (this.options[optionKey] === false) return false;
    }

    return true;
  }

  render(scene: ResolvedScene, options: RenderOptions = {}): string {
    this.options = options;
    if (options.sheetId && scene.sheets?.[options.sheetId]) {
      return this.renderSheet(scene, options.sheetId, options);
    }

    this.renderedIds.clear();
    this.debugElements = [];

    const padding = options.padding ?? scene.padding ?? 20;
    const showAnchors = options.showAnchors ?? false;
    const objects = Object.values(scene.objects);

    if (objects.length === 0) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="display: block;"></svg>`;
    }

    const bbox = scene.bbox || { x: 0, y: 0, width: 100, height: 100 };
    const { x: minX, y: minY, width, height } = bbox;

    let dx = 0;
    let dy = 0;
    const origin = scene.origin || "top-left";

    if (origin === "bottom-left") {
      dy = -(minY + height);
    } else if (origin === "center") {
      dx = -(minX + width / 2);
      dy = -(minY + height / 2);
    }

    const adjustedMinX = minX + dx;
    const adjustedMinY = minY + dy;
    const viewBox = `${adjustedMinX - padding} ${adjustedMinY - padding} ${width + padding * 2} ${height + padding * 2}`;

    const elements: string[] = [];
    
    // Identify top-level objects (non-children)
    const childIds = new Set<string>();
    objects.forEach(obj => {
      if (obj.type !== "clone" && "children" in obj && Array.isArray(obj.children)) {
        obj.children.forEach((cid: string) => childIds.add(cid));
      }
    });

    const rootObjects = objects.filter(obj => !childIds.has(obj.id));

    rootObjects.forEach(obj => {
      const html = this.renderRecursive(obj, scene, {}, showAnchors);
      if (html) elements.push(html);
    });

    // 4. Render Violations (if present)
    const violationElements: string[] = [];
    if (scene.violations && scene.violations.length > 0) {
      scene.violations.forEach(v => {
        if (v.visualHelper) {
          const { x1, y1, x2, y2 } = v.visualHelper;
          violationElements.push(`
            <g class="violation-indicator violation-${v.type}" opacity="0.8">
              <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="red" stroke-width="1.5" stroke-dasharray="4 2" vector-effect="non-scaling-stroke">
                <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />
              </line>
              <circle cx="${x1}" cy="${y1}" r="2.5" fill="red" />
              <circle cx="${x2}" cy="${y2}" r="2.5" fill="none" stroke="red" stroke-width="1" vector-effect="non-scaling-stroke" />
            </g>
          `);
        }
      });
    }

    // Orientation handling (Y-up)
    let orientationAttr = "";
    if (scene.orientation === "y-up") {
        orientationAttr = `scale(1, -1)`;
    }

    const sceneTransform = [
        dx || dy ? `translate(${dx}, ${dy})` : "",
        orientationAttr
    ].filter(Boolean).join(" ");

    const transformWrapper = sceneTransform ? `<g transform="${sceneTransform}">` : "";
    const transformWrapperEnd = sceneTransform ? `</g>` : "";

    let svgWidth = '100%';
    let svgHeight = ''; // Default for web embed: no height attribute
    if (options.physicalMode && scene.unit && scene.unit !== 'px') {
        const u = scene.unit === 'm' ? 'mm' : scene.unit;
        const w = scene.unit === 'm' ? (width + padding * 2) * 1000 : (width + padding * 2);
        const h = scene.unit === 'm' ? (height + padding * 2) * 1000 : (height + padding * 2);
        svgWidth = `${w}${u}`;
        svgHeight = ` height="${h}${u}"`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${svgWidth}"${svgHeight} style="display: block;" preserveAspectRatio="xMidYMid meet">
  <defs>
    <marker id="arrow-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto-start-reverse">
      <path d="M 0 0 L 6 3 L 0 6 z" fill="red" />
    </marker>
    <marker id="arrow-green" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto-start-reverse">
      <path d="M 0 0 L 6 3 L 0 6 z" fill="green" />
    </marker>
  </defs>
  ${transformWrapper}
    ${elements.join("\n    ")}
    ${violationElements.join("\n    ")}
    ${this.debugElements.join("\n    ")}
  ${transformWrapperEnd}
</svg>`;
  }

  private renderRecursive(
    obj: ResolvedObject, 
    scene: ResolvedScene,
    parentMeta: any = {}, 
    showAnchors: boolean = false,
    idPrefix = "",
    isCloneDescendant = false
  ): string {
    const fullId = idPrefix ? `${idPrefix}.${obj.id}` : obj.id;
    
    const meta = isCloneDescendant ? { ...obj.meta, ...parentMeta } : { ...parentMeta, ...obj.meta };
    if (meta.visible === false) return "";

    if (obj.type === "point" && meta.pointShape === undefined) {
      meta.pointShape = this.options.pointShape || "plus";
    }

    const isDimension = obj.type === "dimension" || meta.role === "dimension";
    if (isDimension && !meta.role) meta.role = "dimension";
    
    const isAnnotation = obj.type === "annotation" || meta.role === "annotation";

    if (!this.shouldRenderRole(meta.role)) return "";
    if (!idPrefix && this.renderedIds.has(obj.id)) return "";
    if (!idPrefix) this.renderedIds.add(obj.id);

    if (parentMeta.opacity !== undefined && obj.meta?.opacity !== undefined) {
      meta.opacity = parentMeta.opacity * obj.meta.opacity;
    } else if (parentMeta.opacity !== undefined) {
      meta.opacity = parentMeta.opacity;
    }


    if (obj.type === "group" || obj.type === "clone" || obj.type === "collection" || obj.type === "component") {
      const childrenHtml = (obj.children || [])
        .map((childId: string) => {
          const child = scene.objects[childId];
          return child ? this.renderRecursive(child, scene, meta, showAnchors, obj.type === "clone" ? obj.id : idPrefix, isCloneDescendant || obj.type === "clone") : "";
        })
        .join("\n    ");
      
      const opacityAttr = meta.opacity !== undefined ? `opacity="${meta.opacity}"` : "";
      const transformAttr = obj.transform ? getTransformString(obj.transform) : "";
      const metadataAttrs = getMetadataAttributes(meta, obj);

      const escapedId = escapeXml(fullId);
      return `<g id="${escapedId}"${metadataAttrs} ${transformAttr} ${opacityAttr}>
    <title>${escapedId}</title>
    ${childrenHtml}
  </g>`;
    }

    const commonAttr = getCommonAttributes(fullId, meta, this.options, obj.type, scene, obj);
    const primitiveHtml = renderPrimitive(obj, commonAttr, meta, scene);
    if (!primitiveHtml) return "";
    let finalHtml = primitiveHtml;
    if (this.options.showBoundingBox) {
      const bbox = calculateBoundingBox({ [obj.id]: obj });
      finalHtml += `\n<rect x="${bbox.x}" y="${bbox.y}" width="${bbox.width}" height="${bbox.height}" fill="none" stroke="fuchsia" stroke-width="1" stroke-dasharray="2" vector-effect="non-scaling-stroke" />`;
    }
    if (this.options.showLabels) {
      const sceneBbox = scene.bbox;
      const maxDim = sceneBbox ? Math.hypot(sceneBbox.width, sceneBbox.height) : 100;
      const scaleRef = maxDim > 0 ? maxDim : 100;
      const defFontSize = Math.max(scaleRef * 0.03, 1);
      
      const bbox = calculateBoundingBox({ [obj.id]: obj });
      const labelText = meta.label || obj.id;
      finalHtml += `\n<text x="${bbox.x + bbox.width / 2}" y="${bbox.y - defFontSize * 0.5}" font-size="${defFontSize}px" fill="fuchsia" text-anchor="middle" font-family="monospace">${escapeXml(String(labelText))}</text>`;
    }

    if (showAnchors || this.options.showAnchors) {
      finalHtml += renderAnchors(obj, scene);
    }

    if (obj.transform) {
      const transformAttr = getTransformString(obj.transform);
      const escapedId = escapeXml(fullId);
      return `<g id="${escapedId}.transform" ${transformAttr}>${finalHtml}</g>`;
    }
    return finalHtml;
  }

  private renderSheet(scene: ResolvedScene, sheetId: string, options: RenderOptions): string {
    const sheet = scene.sheets![sheetId];
    const width = sheet.width;
    const height = sheet.height;

    let p = 10;
    if (scene.unit === "cm") p = 1;
    else if (scene.unit === "m") p = 0.01;
    else if (scene.unit === "px") p = 10 * (96 / 25.4);

    const mm = p / 10;
    const viewBox = `0 0 ${width} ${height}`;

    const clips: string[] = [];
    const viewElements: string[] = [];

    sheet.views.forEach((vPlacement, idx) => {
      const view = scene.views?.[vPlacement.use];
      if (!view) return;

    // Removed clipPath to avoid cutting off annotations outside the bounding box
    // const clipId = \`clip-\${sheetId}-\${vPlacement.use}-\${idx}\`;

      const scale = view.scaleFactor ?? 1;
      const viewOriginX = scale !== 0 ? view.bbox.x / scale : view.bbox.x;
      const viewOriginY = scale !== 0 ? view.bbox.y / scale : view.bbox.y;

      const childIds = new Set<string>();
      Object.values(view.objects).forEach((obj: any) => {
        if (obj.children && Array.isArray(obj.children)) {
          obj.children.forEach((cid: string) => childIds.add(cid));
        }
      });

      const rootObjects = Object.values(view.objects).filter((obj: any) => !childIds.has(obj.id));

      const elements: string[] = [];
      rootObjects.forEach((obj: any) => {
        const html = this.renderRecursive(
          obj,
          {
            ...scene,
            objects: view.objects,
            __physicalPreview: true,
            __viewScale: scale,
          } as any,
          {},
          false,
          `sheet.${vPlacement.use}`
        );
        if (html) elements.push(html);
      });

      const transformStr = `translate(${vPlacement.x}, ${vPlacement.y}) scale(${scale}) translate(${-viewOriginX}, ${-viewOriginY})`;

      viewElements.push(`
    <!-- Viewport: ${vPlacement.use} -->
    <g transform="${transformStr}">
      ${elements.join("\\n        ")}
    </g>
    <!-- Viewport Border & Label -->
    <rect x="${vPlacement.x}" y="${vPlacement.y}" width="${vPlacement.width}" height="${vPlacement.height}" fill="none" stroke="#666" stroke-width="${0.5 * mm}" stroke-dasharray="${2 * mm} ${2 * mm}" />
    <text x="${vPlacement.x}" y="${vPlacement.y + vPlacement.height + 8 * mm}" font-size="${6 * mm}px" font-family="sans-serif" fill="#666">${escapeXml(vPlacement.use)} (Scale ${escapeXml(view.scale)})</text>
      `);
    });

    const marginSize = (options.padding ?? scene.padding ?? 10) * mm;
    const margin = `
    <!-- Sheet Border -->
    <rect x="${marginSize}" y="${marginSize}" width="${width - 2 * marginSize}" height="${height - 2 * marginSize}" fill="none" stroke="#333" stroke-width="${0.8 * mm}" />
    `;

    const titleMeta = {
      ...(scene.meta || {}),
      ...(sheet.meta || {}),
    } as Record<string, unknown>;
    const sheetNameText = String(titleMeta.title ?? sheetId);
    const relgeoVersionText = `v${ACTIVE_REL_GEO_VERSION}`;
    const documentVersionText = String(titleMeta.version ?? "-");
    const dateText = String(titleMeta.date ?? "-");
    const sheetSizeText = String(titleMeta.sheetSize ?? (typeof sheet.size === "string" ? sheet.size : "Custom"));

    const tx = width - marginSize - 80 * mm;
    const ty = height - marginSize - 25 * mm;
    const titleBlock = `
    <!-- Title Block -->
    <g transform="translate(${tx}, ${ty})">
      <rect x="0" y="0" width="${80 * mm}" height="${25 * mm}" fill="white" stroke="#333" stroke-width="${0.8 * mm}" />
      <line x1="0" y1="${8 * mm}" x2="${80 * mm}" y2="${8 * mm}" stroke="#333" stroke-width="${0.5 * mm}" />
      <line x1="${45 * mm}" y1="${8 * mm}" x2="${45 * mm}" y2="${25 * mm}" stroke="#333" stroke-width="${0.5 * mm}" />
      <text x="${4 * mm}" y="${6 * mm}" font-size="${4.5 * mm}px" font-family="sans-serif" font-weight="bold" fill="#333">SHEET: ${escapeXml(sheetNameText)}</text>
      <text x="${4 * mm}" y="${14 * mm}" font-size="${3.5 * mm}px" font-family="sans-serif" fill="#666">RELGEO: ${escapeXml(relgeoVersionText)}</text>
      <text x="${4 * mm}" y="${20 * mm}" font-size="${3.5 * mm}px" font-family="sans-serif" fill="#666">DATE: ${escapeXml(dateText)}</text>
      <text x="${49 * mm}" y="${14 * mm}" font-size="${3.5 * mm}px" font-family="sans-serif" fill="#666">SIZE: ${escapeXml(sheetSizeText)}</text>
      <text x="${49 * mm}" y="${20 * mm}" font-size="${3.5 * mm}px" font-family="sans-serif" fill="#666">DOC VER: ${escapeXml(documentVersionText)}</text>
    </g>
    `;

    const u = scene.unit === "m" ? "mm" : scene.unit;
    const w = scene.unit === "m" ? width * 1000 : width;
    const h = scene.unit === "m" ? height * 1000 : height;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${w}${u}" height="${h}${u}" style="display: block;" preserveAspectRatio="xMidYMid meet">
  <defs>
    <marker id="arrow-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto-start-reverse">
      <path d="M 0 0 L 6 3 L 0 6 z" fill="red" />
    </marker>
    <marker id="arrow-green" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto-start-reverse">
      <path d="M 0 0 L 6 3 L 0 6 z" fill="green" />
    </marker>
    ${clips.join("\n")}
  </defs>
  <!-- Background -->
  <rect x="-10" y="-10" width="${width + 20}" height="${height + 20}" fill="#f3f4f6" />
  <!-- Paper Page -->
  ${margin}
  <!-- Viewports Content -->
  ${viewElements.join("\n")}
  <!-- CAD Info -->
  ${titleBlock}
</svg>`;
  }
}

export function renderToSVG(
  scene: ResolvedScene,
  options: RenderOptions = {}
): string {
  const renderer = new SVGRenderer();
  return renderer.render(scene, options);
}
