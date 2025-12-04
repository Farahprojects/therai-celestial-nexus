// Sync UI normalization - converts nested Sync payload to flat SubjectVM structure
// Enables reusing single-person components for both people in a relationship

type Angles = Record<string, { deg?: number; sign?: string }>;
type Houses = Record<string, { deg?: number; sign?: string }>;
type Planets = Record<string, { deg?: number; sign?: string; house?: number; house_natal?: number; retrograde?: boolean }>;

type AspectData = Record<string, unknown>;

type NatalBlock = {
  angles?: Angles;
  houses?: Houses;
  planets?: Planets;
  aspects?: AspectData[];
  meta?: { tz?: string }
};

type TransitBlock = {
  angles?: Angles;
  houses?: Houses;
  planets?: Planets;
  aspects_to_natal?: AspectData[];
  requested_local_datetime?: string;
  requested_local_time?: string;
  datetime_utc?: string;
  timezone?: string
};

type PersonKey = "person_a" | "person_b";

export type SubjectVM = {
  key: PersonKey;
  name: string;
  natal: NatalBlock;
  transits?: TransitBlock;
  tzDisplay?: string;        // prefer transits.timezone, else natal.meta.tz
};

export type SyncVM = {
  analysisDate: string;      // meta.date + meta.time
  timeBasis?: string;        // meta.time_basis
  subjects: SubjectVM[];     // one or two subjects
  synastryPairs?: AspectData[];     // payload.synastry_aspects.pairs
  compositePlanets?: Record<string, { deg?: number; sign?: string }>;
};

export function normalizeSync(payload: unknown): SyncVM {
  const p = payload as Record<string, unknown> | null | undefined;
  const meta = (p?.meta as Record<string, unknown>) ?? {};
  let analysisDate = [(meta.date as string), (meta.time as string)].filter(Boolean).join(" ");
  const timeBasis = meta.time_basis as string | undefined;

  const natal = p?.natal as Record<string, unknown> | undefined;
  const natalSubjects = (natal?.subjects as Record<string, unknown>) ?? {};
  const trans = (p?.transits as Record<string, unknown>) ?? {};

  // Prefer subject-specific local datetime if provided by Swiss payload
  const transA = trans?.person_a as Record<string, unknown> | undefined;
  const transB = trans?.person_b as Record<string, unknown> | undefined;
  const rlA = (transA?.requested_local_datetime as string) || (transA?.requested_local_time as string);
  const rlB = (transB?.requested_local_datetime as string) || (transB?.requested_local_time as string);
  if (rlA) analysisDate = rlA;
  else if (rlB) analysisDate = rlB;

  const makeSubject = (key: PersonKey): SubjectVM | null => {
    const natal = (natalSubjects?.[key] as Record<string, unknown>) ?? {};
    const transits = trans?.[key] as TransitBlock | undefined;
    
    if (!natal && !transits) {
      return null;
    }

    const name =
      (natal?.name as string) ??
      ((transits as Record<string, unknown>)?.name as string) ??
      (key === "person_a" ? "Person A" : "Person B");

    const transitsRecord = transits as Record<string, unknown> | undefined;
    const natalMeta = natal?.meta as Record<string, unknown> | undefined;
    const tzDisplay =
      (transitsRecord?.timezone && transitsRecord.timezone !== 'UTC') 
        ? transitsRecord.timezone as string
        : (natalMeta?.tz as string) || undefined;

    return { 
      key, 
      name, 
      natal: natal as NatalBlock || {}, 
      transits, 
      tzDisplay 
    };
  };

  const subjects = (["person_a", "person_b"] as PersonKey[])
    .map(makeSubject)
    .filter(Boolean) as SubjectVM[];

  const synastryAspects = p?.synastry_aspects as Record<string, unknown> | undefined;
  const compositeChart = p?.composite_chart as Record<string, unknown> | undefined;
  
  return {
    analysisDate,
    timeBasis,
    subjects,
    synastryPairs: (synastryAspects?.pairs as AspectData[]) ?? [],
    compositePlanets: (compositeChart?.planets as Record<string, { deg?: number; sign?: string }>) ?? {},
  };
}
