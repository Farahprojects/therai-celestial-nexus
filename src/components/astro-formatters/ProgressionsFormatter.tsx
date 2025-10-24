import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartHeader } from './shared/ChartHeader';
import { AspectTable } from './shared/AspectTable';
import { HouseCusps } from './shared/HouseCusps';
import { ChartAngles } from './shared/ChartAngles';
import { PlanetaryPositions } from './shared/PlanetaryPositions';

interface ProgressionsFormatterProps {
  swissData: any;
  reportData: any;
  className?: string;
}

export const ProgressionsFormatter: React.FC<ProgressionsFormatterProps> = ({
  swissData,
  reportData,
  className = ''
}) => {
  if (!swissData) {
    return (
      <div className={`text-center text-gray-500 py-16 ${className}`}>
        <p className="text-lg font-light">No progressions data available.</p>
      </div>
    );
  }

  // Progressions data has flat structure: { planets, houses, angles, aspects, meta }
  const { planets, houses, angles, aspects, meta } = swissData;

  // Get name from reportData if available
  const name = reportData?.guest_report?.report_data?.name || reportData?.name || 'Your';
  
  return (
    <div className={`font-inter max-w-4xl mx-auto py-4 md:py-8 px-4 md:px-0 ${className}`}>
      <ChartHeader
        name={`${name} Progressed Chart`}
        birthDate={meta?.date ? new Date(meta.date).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric'
        }) : ''}
        birthLocation={meta?.location}
        latitude={meta?.lat}
        longitude={meta?.lon}
      />

      <div className="space-y-4 md:space-y-8 mt-4 md:mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl font-light text-gray-800">
              Secondary Progressions
            </CardTitle>
            <p className="text-sm text-gray-600 font-light mt-2">
              Your progressed chart shows your inner psychological and spiritual evolution. 
              Each day after birth represents one year of life, revealing your soul's journey.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-8">
            {angles && <ChartAngles angles={angles} />}
            {houses && <HouseCusps houses={houses} title="Progressed House Cusps" />}
            {planets && <PlanetaryPositions planets={planets} title="Progressed Planetary Positions" />}
            {aspects && <AspectTable aspects={aspects} title="Progressed Aspects" />}
          </CardContent>
        </Card>

        {/* Meta Information */}
        {meta && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-light text-gray-800">Chart Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 font-light">House System:</span>
                  <span className="ml-2 font-medium">
                    {meta.house_system === 'P' ? 'Placidus' : 
                     meta.house_system === 'K' ? 'Koch' : 
                     meta.house_system === 'W' ? 'Whole Sign' : 
                     meta.house_system}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 font-light">Zodiac:</span>
                  <span className="ml-2 font-medium">{meta.zodiac_type || 'Tropical'}</span>
                </div>
                <div>
                  <span className="text-gray-600 font-light">Engine:</span>
                  <span className="ml-2 font-medium">{meta.engine || 'Swiss Ephemeris'}</span>
                </div>
                {meta.tz && (
                  <div>
                    <span className="text-gray-600 font-light">Timezone:</span>
                    <span className="ml-2 font-medium">{meta.tz}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

