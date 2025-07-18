
import React from 'react';

interface Angle {
  name: string;
  sign: string;
  deg: number;
  min: number;
}

interface ChartAnglesProps {
  angles: Angle[] | Record<string, any>;
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
    : Object.entries(angles).map(([name, data]: [string, any]) => ({
        name,
        sign: data.sign || '',
        deg: Math.floor(data.degree || data.deg || 0),
        min: Math.round(((data.degree || data.deg || 0) - Math.floor(data.degree || data.deg || 0)) * 60)
      }));

  if (angleArray.length === 0) return null;

  return (
    <div className="mb-12">
      <h2 className="text-xl font-light text-gray-900 mb-8 text-center tracking-wide uppercase">
        {title}
      </h2>
      
      <div className="max-w-2xl mx-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-medium text-gray-900 text-sm">Angle</th>
              <th className="text-right py-3 px-4 font-medium text-gray-900 text-sm">Position</th>
            </tr>
          </thead>
          <tbody>
            {angleArray.map((angle) => {
              const position = `${String(angle.deg).padStart(2, "0")}°${String(angle.min).padStart(2, "0")}' in ${angle.sign}`;
              
              return (
                <tr key={angle.name} className="border-b border-gray-100 hover:bg-gray-50/30">
                  <td className="py-3 px-4 font-medium text-gray-900">{angle.name}</td>
                  <td className="py-3 px-4 text-gray-700 text-right">{position}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
