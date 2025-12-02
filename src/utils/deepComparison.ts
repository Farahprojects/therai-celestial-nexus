
/**
 * Deep comparison utility for detecting meaningful changes in objects
 * Handles common cases where JSON.stringify might give false positives
 */
export function deepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;
  
  if (obj1 == null || obj2 == null) return obj1 === obj2;
  
  if (typeof obj1 !== typeof obj2) return false;
  
  if (typeof obj1 !== 'object') return obj1 === obj2;
  
  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
  
  if (Array.isArray(obj1)) {
    if (obj1.length !== obj2.length) return false;
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) return false;
    }
    return true;
  }
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  
  return true;
}

/**
 * Normalize data to ensure consistent comparison
 * Removes undefined values and sorts arrays/objects consistently
 */
export function normalizeForComparison(data: unknown): unknown {
  if (data === null || data === undefined) return null;

  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(normalizeForComparison).filter(item => item !== undefined);
  }

  const normalized: Record<string, unknown> = {};
  const keys = Object.keys(data).sort();
  
  for (const key of keys) {
    const value = normalizeForComparison(data[key]);
    if (value !== undefined) {
      normalized[key] = value;
    }
  }
  
  return normalized;
}
