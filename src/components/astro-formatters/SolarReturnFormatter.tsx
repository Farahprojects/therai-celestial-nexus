import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartHeader } from './shared/ChartHeader';
import { AspectTable } from './shared/AspectTable';
import { HouseCusps } from './shared/HouseCusps';
import { ChartAngles } from './shared/ChartAngles';
import { PlanetaryPositions } from './shared/PlanetaryPositions';

interface SolarReturnData {
  planets?: unknown;
  houses?: unknown;
  angles?: unknown;
  aspects?: unknown;
  meta?: {
    location?: string;
    lat?: number;
    lon?: number;
    house_system?: string;
    zodiac_type?: string;
    engine?: string;
    tz?: string;
  };
  datetime_local?: string;
}

interface ReportData {
  guest_report?: {
    report_data?: {
      name?: string;
    };
  };
  name?: string;
}

interface SolarReturnFormatterProps {
  swissData: Record<string, unknown>;
  reportData: Record<string, unknown>;
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
  const data = swissData as SolarReturnData;
  const { planets, houses, angles, aspects, meta, datetime_local } = data;

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
  const reportDataTyped = reportData as ReportData;
  const name = reportDataTyped?.guest_report?.report_data?.name || reportDataTyped?.name || 'Your';
  
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
                <div>
                  <span className="text-gray-600 font-light">Timezone:</span>
                  <span className="ml-2 font-medium">{meta.tz}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

