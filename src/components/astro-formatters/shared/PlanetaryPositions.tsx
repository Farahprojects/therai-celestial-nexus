
import React from 'react';
import { formatPosDecimalWithHouse } from '@/lib/astro/format';

interface Planet {
  name: string;
  sign: string;
  deg: number;
  house?: number;
  retro?: boolean;
}

interface PlanetaryPositionsProps {
  planets: Planet[] | Record<string, { sign?: string; degree?: number; deg?: number; house?: number; retrograde?: boolean; retro?: boolean }>;
  title?: string;
}

export const PlanetaryPositions: React.FC<PlanetaryPositionsProps> = ({
  planets,
  title = "PLANETARY POSITIONS"
}) => {
  if (!planets) return null;

  // Convert object format to array format if needed
  const planetArray: Planet[] = Array.isArray(planets)
    ? planets
    : Object.entries(planets).map(([name, data]: [string, { sign?: string; degree?: number; deg?: number; house?: number; retrograde?: boolean; retro?: boolean }]) => ({
        name,
        sign: data.sign || '',
        deg: data.degree || data.deg || 0,
        house: data.house,
        retro: data.retrograde || data.retro
      }));

  if (planetArray.length === 0) return null;

  return (
    <div className="mb-12">
      <h2 className="text-lg md:text-xl font-light text-gray-900 mb-4 md:mb-8 text-center tracking-wide uppercase">
        {title}
      </h2>
      
      <div className="max-w-2xl mx-auto overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-gray-900 text-xs md:text-sm">Planet</th>
              <th className="text-right py-2 px-2 md:py-3 md:px-4 font-medium text-gray-900 text-xs md:text-sm">Position</th>
            </tr>
          </thead>
          <tbody>
            {planetArray.map((planet) => {
              const position = formatPosDecimalWithHouse(planet);
              
              return (
                <tr key={planet.name} className="border-b border-gray-100 hover:bg-gray-50/30">
                  <td className="py-2 px-2 md:py-3 md:px-4 font-medium text-gray-900 text-left text-xs md:text-sm">
                    {planet.name}
                    {planet.retro && <span className="ml-1 text-gray-600">(R)</span>}
                  </td>
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
