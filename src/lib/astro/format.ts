// Unified astrological position formatting utilities
// Handles positions with {deg: number (0-30), sign: string} format
// DECIMAL-ONLY: No minutes conversion, displays exact decimal degrees

export type ZodiacPos = { 
  deg?: number; 
  sign?: string; 
};

/**
 * Format decimal degrees as exact decimal (e.g., 11.83 → "11.83°", 27.06 → "27.06°")
 * No minutes conversion - displays positions exactly as provided by Swiss payload
 */
export function formatPosDecimal(p?: ZodiacPos): string {
  if (!p || typeof p.deg !== "number" || !p.sign) return "—";
  
  return `${p.deg.toFixed(2)}° in ${p.sign}`;
}

/**
 * Format a position with house information appended
 * e.g., "11.83° in Gemini (House 7)" or "27.06° in Cancer (Natal House 1)"
 */
export function formatPosDecimalWithHouse(p?: ZodiacPos & { house?: number; natal_house?: number }): string {
  const basePos = formatPosDecimal(p);
  if (basePos === "—") return basePos;
  
  let houseLabel = "";
  if (p?.house) {
    houseLabel = ` (House ${p.house})`;
  } else if (p?.natal_house) {
    houseLabel = ` (Natal House ${p.natal_house})`;
  }
  
  return basePos + houseLabel;
}

// DEPRECATED: Legacy minutes-based formatters - use formatPosDecimal instead
/**
 * @deprecated Use formatPosDecimal instead - this adds unnecessary minutes conversion
 */
export function formatDegMin(dec?: number): string {
  console.warn('[DEPRECATED] formatDegMin: Use formatPosDecimal instead');
  if (typeof dec !== "number" || !isFinite(dec)) return "—";
  
  const d = Math.floor(dec);
  const m = Math.floor((dec - d) * 60);
  
  return `${d}°${String(m).padStart(2, "0")}'`;
}

/**
 * @deprecated Use formatPosDecimal instead - this adds unnecessary minutes conversion
 */
export function formatPos(p?: ZodiacPos): string {
  console.warn('[DEPRECATED] formatPos: Use formatPosDecimal instead');
  if (!p || typeof p.deg !== "number" || !p.sign) return "—";
  
  return `${formatDegMin(p.deg)} in ${p.sign}`;
}

/**
 * @deprecated Use formatPosDecimalWithHouse instead - this adds unnecessary minutes conversion
 */
export function formatPosWithHouse(p?: ZodiacPos & { house?: number; natal_house?: number }): string {
  console.warn('[DEPRECATED] formatPosWithHouse: Use formatPosDecimalWithHouse instead');
  const basePos = formatPos(p);
  if (basePos === "—") return basePos;
  
  let houseLabel = "";
  if (p?.house) {
    houseLabel = ` (House ${p.house})`;
  } else if (p?.natal_house) {
    houseLabel = ` (Natal House ${p.natal_house})`;
  }
  
  return basePos + houseLabel;
}
