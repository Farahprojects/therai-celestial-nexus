// Performance logger for debugging chat latency

const perfMarks = new Map<string, number>();

export const perfMark = (label: string) => {
  const now = performance.now();
  perfMarks.set(label, now);
  console.log(`[PERF] ${label}: ${now.toFixed(2)}ms`);
};

export const perfMeasure = (label: string, startMark: string) => {
  const start = perfMarks.get(startMark);
  if (!start) {
    console.warn(`[PERF] Start mark "${startMark}" not found`);
    return;
  }
  const duration = performance.now() - start;
  console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms (from ${startMark})`);
  return duration;
};

export const perfClear = () => {
  perfMarks.clear();
};
