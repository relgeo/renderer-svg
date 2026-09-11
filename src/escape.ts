/**
 * Escapes special characters for XML/SVG.
 */
export function escapeXml(unsafe: string | number | undefined | null): string {
    if (unsafe === undefined || unsafe === null) return "";
    const str = String(unsafe);
    return str.replace(/[&<>"']/g, (m) => {
        switch (m) {
            case "&": return "&amp;";
            case "<": return "&lt;";
            case ">": return "&gt;";
            case "\"": return "&quot;";
            case "'": return "&apos;";
            default: return m;
        }
    });
}
