import React, { useEffect, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { parseAstroData } from '@/lib/astroFormatter';
import { normalizeSync } from '@/lib/astro/normalizeSync';
import { ChartHeader } from './shared/ChartHeader';
import { AspectTable } from './shared/AspectTable';
import { ChartAngles } from './shared/ChartAngles';
import { HouseCusps } from './shared/HouseCusps';
import { PlanetaryPositions } from './shared/PlanetaryPositions';
import { TransitMetadata } from './shared/TransitMetadata';
import { formatPosDecimal } from '@/lib/astro/format';

interface SynastryAstroFormatterProps {
  swissData: any;
  reportData: any;
  className?: string;
}

export const SynastryAstroFormatter: React.FC<SynastryAstroFormatterProps> = ({
  swissData,
  reportData,
  className = ''
}) => {
  // Manage the active subject tab at the component level (must be before any conditional returns)
  const [activeTab, setActiveTab] = useState<string>('person_a');

  // Normalize raw payload first for UI consumption
  const vm = swissData ? normalizeSync(swissData) : null;
  
  // Use the dynamic parser for synastry/composite sections
  const astroData = swissData ? parseAstroData(swissData) : null;
  const { synastry_aspects, composite_chart } = astroData || ({} as any);

  // Initialize/adjust tab when subjects are available
  useEffect(() => {
    const firstKey = vm?.subjects?.[0]?.key ?? 'person_a';
    setActiveTab(firstKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm?.subjects?.length]);

  return (
    <div className={`font-inter max-w-4xl mx-auto py-8 ${className}`}>
      {!swissData || !vm ? (
        <div className={`text-center text-gray-500 py-16 ${className}`}>
          <p className="text-lg font-light">No synastry data available for this report.</p>
        </div>
      ) : (
        <>
          <ChartHeader
            title="Relationship Chart"
            name={vm.subjects.map(s => s.name).join(' & ') || 'Synastry Analysis'}
            date={vm.analysisDate}
            subtitle={vm.timeBasis === 'per_subject_local' ? 'Times shown per subject\'s local timezone' : undefined}
          />

      <div className="space-y-8 mt-8">
        {/* Synastry Aspects */}
        {synastry_aspects && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-light text-gray-800">
                Synastry: The Core Dynamics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                These aspects show the fundamental interactions between your two personalities.
              </p>
              <AspectTable aspects={synastry_aspects.aspects} />
            </CardContent>
          </Card>
        )}

        {/* Composite Chart */}
        {composite_chart && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-light text-gray-800">
                Composite Chart: The Relationship's Identity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                This chart represents the relationship itself as a third entity.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs md:text-sm">Planet</TableHead>
                      <TableHead className="text-xs md:text-sm">Degree</TableHead>
                      <TableHead className="text-xs md:text-sm">Sign</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {composite_chart?.map((planet: any) => (
                      <TableRow key={planet.name}>
                        <TableCell className="font-medium whitespace-nowrap text-xs md:text-sm">
                          <span className="mr-2">{planet.unicode}</span> {planet.name}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm">{`${planet.deg.toFixed(2)}°`}</TableCell>
                        <TableCell className="text-xs md:text-sm">{planet.sign}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Individual Charts */}
        {vm.subjects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-light text-gray-800">
                Individual Charts: Natal & Current Transits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  {vm.subjects.map((subject) => (
                    <TabsTrigger key={`tab-${subject.key}`} value={subject.key}>
                      {subject.name}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {vm.subjects.map((subject) => {
                  // Compute final timezone display
                  const tzDisplay = (subject.transits?.timezone && subject.transits.timezone !== 'UTC')
                    ? subject.transits.timezone
                    : subject.natal?.meta?.tz ?? '—';

                  return (
                    <TabsContent key={`panel-${subject.key}`} value={subject.key} className="space-y-6">
                      {/* Natal Section */}
                      <div>
                        <h4 className="text-xl font-light text-gray-700 mb-4">Natal Chart</h4>
                        <div className="grid gap-6">
                          {subject.natal?.angles && (
                            <ChartAngles angles={subject.natal.angles} title="Chart Angles" />
                          )}
                          {subject.natal?.houses && (
                            <HouseCusps houses={subject.natal.houses} title="House Cusps" />
                          )}
                          {subject.natal?.planets && (
                            <PlanetaryPositions planets={subject.natal.planets} title="Planetary Positions" />
                          )}
                          {subject.natal?.aspects && subject.natal.aspects.length > 0 && (
                            <AspectTable aspects={subject.natal.aspects} title="Natal Aspects" />
                          )}
                        </div>
                      </div>

                      {/* Current Transits Section */}
                      {subject.transits && (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xl font-light text-gray-700">Current Transits</h4>
                            <span className="text-sm text-gray-500">
                              Timezone: {tzDisplay}
                            </span>
                          </div>

                          {(subject.transits.datetime_utc || subject.transits.requested_local_time) && (
                            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-600">
                                Transit Time: {subject.transits.requested_local_time || 'N/A'} ({tzDisplay})
                              </p>
                            </div>
                          )}

                          <div className="grid gap-6">
                            {subject.transits?.planets && (
                              <PlanetaryPositions
                                planets={subject.transits.planets}
                                title="Transit Positions"
                              />
                            )}
                            {subject.transits?.aspects_to_natal && subject.transits.aspects_to_natal.length > 0 && (
                              <AspectTable
                                aspects={subject.transits.aspects_to_natal}
                                title="Transits to Natal"
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
        </>
      )}
    </div>
  );
};