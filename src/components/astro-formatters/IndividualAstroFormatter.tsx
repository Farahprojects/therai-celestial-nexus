
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartHeader } from './shared/ChartHeader';
import { AspectTable } from './shared/AspectTable';
import { HouseCusps } from './shared/HouseCusps';
import { ChartAngles } from './shared/ChartAngles';
import { PlanetaryPositions } from './shared/PlanetaryPositions';
import { parseAstroData } from '@/lib/astroFormatter';
import { TransitMetadata } from './shared/TransitMetadata';

interface IndividualAstroFormatterProps {
  swissData: Record<string, unknown>;
  reportData: Record<string, unknown>;
  className?: string;
}

export const IndividualAstroFormatter: React.FC<IndividualAstroFormatterProps> = ({
  swissData,
  reportData,
  className = ''
}) => {
  if (!swissData) {
    return (
      <div className={`text-center text-gray-500 py-16 ${className}`}>
        <p className="text-lg font-light">No astrological data available for this report.</p>
      </div>
    );
  }

  const astroData = parseAstroData(swissData);
  const { subject, natal, transits } = astroData;

  // Extract birth date from swiss_data blocks.natal.meta
  let birthDate = reportData.guest_report?.report_data?.birthDate;
  
  // If not in guest_report, try to extract from swiss_data
  if (!birthDate && swissData?.blocks?.natal?.meta) {
    const natalMeta = swissData.blocks.natal.meta;
    // Extract date from UTC timestamp or use meta.date and meta.time
    if (natalMeta.utc) {
      const date = new Date(natalMeta.utc);
      birthDate = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
      });
    } else if (natalMeta.date && natalMeta.time) {
      const date = new Date(`${natalMeta.date}T${natalMeta.time}`);
      birthDate = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
      });
    }
  }
  
  return (
    <div className={`font-inter max-w-4xl mx-auto py-4 md:py-8 px-4 md:px-0 ${className}`}>
      <ChartHeader
        name={subject?.name || natal?.name || 'Unknown'}
        birthDate={birthDate}
        birthLocation={subject?.location}
        latitude={subject?.lat}
        longitude={subject?.lon}
      />

      <div className="space-y-4 md:space-y-8 mt-4 md:mt-8">
        {natal && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl font-light text-gray-800">
                Natal Chart: Your Core Blueprint
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-8">
              <ChartAngles angles={natal.angles} />
              <HouseCusps houses={natal.houses} title="House Cusps" />
              <PlanetaryPositions planets={natal.planets} title="Natal Planetary Positions" />
              <AspectTable aspects={natal.aspects} title="Natal Aspects" />
            </CardContent>
          </Card>
        )}

        {transits && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl font-light text-gray-800">
                Current Transits: The Present Moment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-8">
              <TransitMetadata transits={transits} />
              <PlanetaryPositions planets={transits.planets} title="Current Transit Positions" />
              <AspectTable aspects={transits.aspects_to_natal} title="Transit Aspects to Natal" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
