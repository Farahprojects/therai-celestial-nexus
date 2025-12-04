import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartHeader } from './shared/ChartHeader';
import { AspectTable } from './shared/AspectTable';
import { PlanetaryPositions } from './shared/PlanetaryPositions';

interface Planet {
  name: string;
  sign: string;
  deg: number;
  house?: number;
  retro?: boolean;
}

interface Aspect {
  a?: string;
  b?: string;
  type?: string;
  orb?: number;
  [key: string]: unknown;
}

interface ReportData {
  name?: string;
  birthDate?: string;
  birthLocation?: string;
  [key: string]: unknown;
}

interface SwissData {
  aspects_to_natal?: Aspect[];
  progressed_planets?: Planet[];
  days_after_birth?: number;
  [key: string]: unknown;
}

interface ProgressionsFormatterProps {
  swissData: SwissData;
  reportData: ReportData;
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
        <p className="text-lg font-light">No Progressions data available for this report.</p>
      </div>
    );
  }

  // Progressions data structure: aspects_to_natal + progressed_planets + days_after_birth
  const { aspects_to_natal, progressed_planets, days_after_birth } = swissData;

  // Calculate progression date from days after birth
  let progressionDate: string | null = null;
  const birthDateStr = reportData.birthDate;
  if (days_after_birth && birthDateStr) {
    const birthDate = new Date(birthDateStr);
    const progressionDateObj = new Date(birthDate.getTime() + (days_after_birth * 24 * 60 * 60 * 1000));
    progressionDate = progressionDateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // Get the correct name from reportData
  const name = reportData?.name || 
               'Your Progressed Chart';

  return (
    <div className={`font-inter max-w-4xl mx-auto py-4 md:py-8 px-4 md:px-0 ${className}`}>
      <ChartHeader
        name={name}
        birthDate={birthDateStr}
        birthLocation={reportData.birthLocation}
      />

      <div className="space-y-4 md:space-y-8 mt-4 md:mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl font-light text-gray-800">
              Progressed Chart
            </CardTitle>
            <p className="text-sm text-gray-600 font-light mt-2">
              Your progressed chart shows your inner psychological evolution over time. 
              These are the current positions of your planets as they've progressed since birth.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 md:space-y-8">
            {progressionDate && days_after_birth && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-blue-900 mb-2">Progression Date</h3>
                <p className="text-blue-800">{progressionDate}</p>
                <p className="text-sm text-blue-700 mt-1">
                  {days_after_birth} days after birth
                </p>
              </div>
            )}
            
            {progressed_planets && progressed_planets.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-4">Progressed Planetary Positions</h3>
                <PlanetaryPositions 
                  planets={progressed_planets} 
                  title="Progressed Planets"
                />
              </div>
            )}
            
            {aspects_to_natal && aspects_to_natal.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-4">Aspects to Natal Chart</h3>
                <p className="text-sm text-gray-600 mb-4">
                  These aspects show how your progressed planets interact with your natal chart positions.
                </p>
                <AspectTable 
                  aspects={aspects_to_natal as Array<{ type: string; [key: string]: unknown }>} 
                  title="Progressed Aspects to Natal"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
