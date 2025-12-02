
import React from 'react';
import { formatPosDecimal } from '@/lib/astro/format';

interface Angle {
  name: string;
  sign: string;
  deg: number;
}

interface ChartAnglesProps {
  angles: Angle[] | Record<string, { sign?: string; degree?: number; deg?: number }>;
  title?: string;
}

export const ChartAngles: React.FC<ChartAnglesProps> = ({
  angles,
  title = "CHART ANGLES"
}) => {
  if (!angles) return null;

  // Convert object format to array format if needed
  const angleArray: Angle[] = Array.isArray(angles)
    ? angles
    : Object.entries(angles).map(([name, data]: [string, { sign?: string; degree?: number; deg?: number }]) => ({
        name,
        sign: data.sign || '',
        deg: data.degree || data.deg || 0
      }));

  if (angleArray.length === 0) return null;

  return (
    <div className="mb-12">
      <h2 className="text-lg md:text-xl font-light text-gray-900 mb-4 md:mb-8 text-center tracking-wide uppercase">
        {title}
      </h2>
      
      <div className="max-w-2xl mx-auto overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-900 text-xs md:text-sm">Angle</th>
              <th className="text-right py-2 px-2 md:py-3 md:px-4 font-medium text-gray-900 text-xs md:text-sm">Position</th>
            </tr>
          </thead>
          <tbody>
            {angleArray.map((angle) => {
              const position = formatPosDecimal(angle);
              
              return (
                <tr key={angle.name} className="border-b border-gray-100 hover:bg-gray-50/30">
                  <td className="py-2 px-2 md:py-3 md:px-4 font-medium text-gray-900 text-xs md:text-sm">{angle.name}</td>
                  <td className="py-2 px-2 md:py-3 md:px-4 text-gray-700 text-right text-xs md:text-sm whitespace-nowrap">{position}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
