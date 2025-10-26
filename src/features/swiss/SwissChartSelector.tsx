import React, { useState } from 'react';
import { User, Calendar, TrendingUp, Users, ChevronRight, CalendarDays, Target } from 'lucide-react';

interface ChartType {
  id: string;
  name: string;
  icon: React.ReactNode;
}

const chartTypes: ChartType[] = [
  {
    id: 'essence', // Maps to /essence endpoint (Natal + Transit combined)
    name: 'The Self',
    icon: <User className="w-5 h-5" />,
  },
  {
    id: 'sync', // Maps to /sync endpoint (Compatibility)
    name: 'Compatibility',
    icon: <Users className="w-5 h-5" />,
  },
  {
    id: 'weekly', // Maps to /weekly endpoint
    name: 'Weekly Snap',
    icon: <CalendarDays className="w-5 h-5" />,
  },
  {
    id: 'focus', // Maps to /focus endpoint
    name: 'Daily Shot',
    icon: <Target className="w-5 h-5" />,
  },
];

interface SwissChartSelectorProps {
  onSelectChart: (chartId: string) => void;
}

export const SwissChartSelector: React.FC<SwissChartSelectorProps> = ({ onSelectChart }) => {
  const [selectedChart, setSelectedChart] = useState<string | null>(null);

  const handleChartClick = (chartId: string) => {
    setSelectedChart(chartId);
    onSelectChart(chartId);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 pb-4">
        <h2 className="text-2xl md:text-3xl font-light text-gray-900 italic">
          Select Insight Type
        </h2>
        <p className="text-sm text-gray-600 font-light">
          Choose the chart you'd like to explore
        </p>
      </div>

      {/* Chart List */}
      <div className="space-y-2">
        {chartTypes.map((chart) => {
          const isSelected = selectedChart === chart.id;
          
          return (
            <button
              key={chart.id}
              onClick={() => handleChartClick(chart.id)}
              className={`
                w-full flex items-center justify-between p-4 rounded-full border-2 transition-all duration-200
                ${
                  isSelected
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 bg-white hover:border-gray-400 hover:bg-gray-50'
                }
              `}
            >
              {/* Icon + Name */}
              <div className="flex items-center gap-3">
                <div
                  className={`
                    flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200
                    ${
                      isSelected
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700'
                    }
                  `}
                >
                  {chart.icon}
                </div>
                <span className="text-base font-light text-gray-900">
                  {chart.name}
                </span>
              </div>

              {/* Arrow Indicator */}
              <ChevronRight
                className={`
                  w-5 h-5 transition-colors duration-200
                  ${isSelected ? 'text-gray-900' : 'text-gray-400'}
                `}
              />
            </button>
          );
        })}
      </div>

    </div>
  );
};

