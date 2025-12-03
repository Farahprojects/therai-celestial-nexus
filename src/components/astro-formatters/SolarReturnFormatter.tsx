import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartHeader } from './shared/ChartHeader';
import { AspectTable } from './shared/AspectTable';
import { HouseCusps } from './shared/HouseCusps';
import { ChartAngles } from './shared/ChartAngles';
import { PlanetaryPositions } from './shared/PlanetaryPositions';

interface Planet {
  name: string;
  sign: string;
  deg: number;
  house?: number;
  retro?: boolean;
}

interface House {
  number: number;
  sign: string;
  deg: number;
}

interface Angle {
  name: string;
  sign: string;
  deg: number;
}

interface Aspect {
  a?: string;
  b?: string;
  type: string;
  orb?: number;
  [key: string]: unknown;
}

interface MetaData {
  location?: string;
  lat?: number;
  lon?: number;
  house_system?: string;
  zodiac_type?: string;
  engine?: string;
  tz?: string;
  [key: string]: unknown;
}

interface SwissData {
  planets?: Planet[];
  houses?: House[];
  angles?: Angle[];
  aspects?: Aspect[];
  meta?: MetaData;
  datetime_local?: string;
  [key: string]: unknown;
}

interface ReportData {
  guest_report?: {
    report_data?: {
      name?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  name?: string;
  [key: string]: unknown;
}

interface SolarReturnFormatterProps {
  swissData: SwissData;
  reportData: ReportData;
  className?: string;
}

export const SolarReturnFormatter: React.FC<SolarReturnFormatterProps> = ({
  swissData,
  reportData,
  className = ''
}) => {
  if (!swissData) {
    return (
      <div className={`text-center text-gray-500 py-16 ${className}`}>
        <p className="text-lg font-light">No solar return data available.</p>
      </div>
    );
  }

  // Solar Return data has flat structure: { planets, houses, angles, aspects, meta }
  const { planets, houses, angles, aspects, meta, datetime_local } = swissData;

  // Extract return date
  let returnDate = '';
  if (datetime_local) {
    const date = new Date(datetime_local);
    returnDate = date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Get name from reportData if available
  const name = reportData?.guest_report?.report_data?.name || reportData?.name || 'Your';
  
  return (
    <div className={`font-inter max-w-4xl mx-auto py-4 md:py-8 px-4 md:px-0 ${className}`}>
      <ChartHeader
        name={`${name} Solar Return`}
        birthDate={returnDate}
        birthLocation={meta?.location}
        latitude={meta?.lat}
        longitude={meta?.lon}
      />

      <div className="space-y-4 md:space-y-8 mt-4 md:mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl font-light text-gray-800">
              Solar Return Chart
            </CardTitle>
            <p className="text-sm text-gray-600 font-light mt-2">
              Your solar return marks the moment the Sun returns to the exact position it was at your birth. 
              This chart reveals the themes and energies for your year ahead.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-8">
            {angles && <ChartAngles angles={angles} />}
            {houses && <HouseCusps houses={houses} title="Solar Return House Cusps" />}
            {planets && <PlanetaryPositions planets={planets} title="Solar Return Planetary Positions" />}
            {aspects && <AspectTable aspects={aspects} title="Solar Return Aspects" />}
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
                {meta.house_system && (
                  <div>
                    <span className="text-gray-600 font-light">House System:</span>
                    <span className="ml-2 font-medium">
                      {meta.house_system === 'P' ? 'Placidus' : 
                       meta.house_system === 'K' ? 'Koch' : 
                       meta.house_system === 'W' ? 'Whole Sign' : 
                       meta.house_system}
                    </span>
                  </div>
                )}
                {meta.zodiac_type && (
                  <div>
                    <span className="text-gray-600 font-light">Zodiac:</span>
                    <span className="ml-2 font-medium">{meta.zodiac_type}</span>
                  </div>
                )}
                {meta.engine && (
                  <div>
                    <span className="text-gray-600 font-light">Engine:</span>
                    <span className="ml-2 font-medium">{meta.engine}</span>
                  </div>
                )}
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
