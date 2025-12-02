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
  
  const meta = payload?.meta ?? {};
  let analysisDate = [meta.date, meta.time].filter(Boolean).join(" ");
  const timeBasis = meta.time_basis;

  const natalSubjects = payload?.natal?.subjects ?? {};
  const trans = payload?.transits ?? {};

  // Prefer subject-specific local datetime if provided by Swiss payload
  const rlA = trans?.person_a?.requested_local_datetime || trans?.person_a?.requested_local_time;
  const rlB = trans?.person_b?.requested_local_datetime || trans?.person_b?.requested_local_time;
  if (rlA) analysisDate = rlA;
  else if (rlB) analysisDate = rlB;

  const makeSubject = (key: PersonKey): SubjectVM | null => {
    const natal = natalSubjects?.[key] ?? {};
    const transits = trans?.[key];
    

    
    if (!natal && !transits) {
      return null;
    }

    const name =
      natal?.name ??
      transits?.name ??
      (key === "person_a" ? "Person A" : "Person B");

    const tzDisplay =
      (transits?.timezone && transits.timezone !== 'UTC') 
        ? transits.timezone 
        : natal?.meta?.tz || undefined;



    return { 
      key, 
      name, 
      natal: natal || {}, 
      transits, 
      tzDisplay 
    };
  };

  const subjects = (["person_a", "person_b"] as PersonKey[])
    .map(makeSubject)
    .filter(Boolean) as SubjectVM[];

  return {
    analysisDate,
    timeBasis,
    subjects,
    synastryPairs: payload?.synastry_aspects?.pairs ?? [],
    compositePlanets: payload?.composite_chart?.planets ?? {},
  };
}
