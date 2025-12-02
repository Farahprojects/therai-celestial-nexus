import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartHeader } from './shared/ChartHeader';
import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, List, CheckCircle2, Activity, AlertTriangle, Zap, Brain } from 'lucide-react';

interface Band {
  name: string;
  hours: number[];
}

interface HourlyGrid {
  scores: number[];
  notes?: string[];
  bands?: Band[];
}

interface SwissData {
  components?: {
    hourly_grid?: HourlyGrid;
  };
  meta?: Record<string, unknown>;
  subject?: Record<string, unknown>;
}

interface ReportData {
  [key: string]: unknown;
}

interface FocusAstroFormatterProps {
  swissData: SwissData;
  reportData: ReportData;
  className?: string;
}

interface TimeBlock {
  startHour: number;
  endHour: number;
  score: number;
  band: string | null;
  notes: string[];
}

interface CategoryData {
  label: string;
  icon: React.ComponentType;
  color: string;
  hours: number;
  blocks: TimeBlock[];
}

const ScoreBadge = ({ score }: { score: number }) => {
  let colorClass = 'bg-gray-200 text-gray-800';
  
  if (score < 0) {
    colorClass = 'bg-red-100 text-red-800 border-red-200';
  } else if (score === 0) {
    colorClass = 'bg-gray-100 text-gray-600';
  } else if (score === 1) {
    colorClass = 'bg-blue-100 text-blue-800';
  } else if (score === 2) {
    colorClass = 'bg-green-100 text-green-800';
  } else if (score >= 3) {
    colorClass = 'bg-green-200 text-green-900 font-medium';
  }

  return <Badge className={`text-sm ${colorClass}`}>{score}</Badge>;
};

const BandBadge = ({ band }: { band: string | null }) => {
  if (!band) return null;
  
  const colorClass = band === 'Surge' 
    ? 'bg-orange-100 text-orange-800 border-orange-200' 
    : 'bg-purple-100 text-purple-800 border-purple-200';
  
  return (
    <Badge variant="outline" className={`text-xs ${colorClass} ml-2`}>
      {band === 'Surge' ? <Zap className="w-3 h-3 mr-1 inline" /> : <Brain className="w-3 h-3 mr-1 inline" />}
      {band}
    </Badge>
  );
};

// Format time for display
const formatHour = (hour: number): string => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
};

// Format time range
const formatTimeRange = (startHour: number, endHour: number): string => {
  if (startHour === endHour) {
    return formatHour(startHour);
  }
  return `${formatHour(startHour)} - ${formatHour(endHour)}`;
};

// Get category for score
const getCategoryForScore = (score: number): { label: string; icon: React.ComponentType; color: string } => {
  if (score >= 2) {
    return { label: 'Deep Work', icon: TrendingUp, color: 'text-green-600' };
  } else if (score === 1) {
    return { label: 'Quick Tasks', icon: CheckCircle2, color: 'text-blue-600' };
  } else if (score === 0) {
    return { label: 'Flexible', icon: Activity, color: 'text-gray-600' };
  } else {
    return { label: 'Caution', icon: AlertTriangle, color: 'text-red-600' };
  }
};

// Group consecutive hours with same score into time blocks
const groupTimeBlocks = (scores: number[], notes: string[], bands: Band[]): TimeBlock[] => {
  const blocks: TimeBlock[] = [];
  
  const getBandForHour = (hour: number): string | null => {
    if (!bands) return null;
    for (const band of bands) {
      if (band.hours.includes(hour)) {
        return band.name;
      }
    }
    return null;
  };
  
  let currentBlock: TimeBlock | null = null;
  
  for (let hour = 0; hour < scores.length; hour++) {
    const score = scores[hour];
    const band = getBandForHour(hour);
    const note = notes[hour];
    
    if (!currentBlock || currentBlock.score !== score || currentBlock.band !== band) {
      // Start new block
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = {
        startHour: hour,
        endHour: hour,
        score: score,
        band: band,
        notes: note && note.trim() ? [note] : []
      };
    } else {
      // Extend current block
      currentBlock.endHour = hour;
      if (note && note.trim()) {
        currentBlock.notes.push(note);
      }
    }
  }
  
  if (currentBlock) {
    blocks.push(currentBlock);
  }
  
  return blocks;
};

export const FocusAstroFormatter: React.FC<FocusAstroFormatterProps> = ({
  swissData,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  reportData: _reportData,
  className = ''
}) => {
  const components = swissData?.components;
  const meta = swissData?.meta ?? {};
  const subject = swissData?.subject ?? {};

  if (!components) {
    return (
      <div className={`text-center text-gray-500 py-16 ${className}`}>
        <p className="text-lg font-light">No focus data available for this report.</p>
      </div>
    );
  }

  const { hourly_grid } = components;
  
  // Format date
  const dateStr = meta.date 
    ? new Date(meta.date).toLocaleDateString('default', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : 'Today';

  // Get time blocks
  const timeBlocks = hourly_grid ? groupTimeBlocks(
    hourly_grid.scores,
    hourly_grid.notes || [],
    hourly_grid.bands || []
  ) : [];

  // Category breakdown
  const categoryBreakdown = timeBlocks.reduce((acc, block) => {
    const category = getCategoryForScore(block.score);
    const hours = block.endHour - block.startHour + 1;
    if (!acc[category.label]) {
      acc[category.label] = { ...category, hours: 0, blocks: [] };
    }
    acc[category.label].hours += hours;
    acc[category.label].blocks.push(block);
    return acc;
  }, {} as Record<string, CategoryData>);

  return (
    <div className={`font-inter max-w-4xl mx-auto py-8 ${className}`}>
      <ChartHeader
        name={subject?.name || 'Unknown'}
        title={`Intra-Day Focus Analysis`}
        date={dateStr}
        subtitle={subject?.location ? `${subject.location} (${subject.tz})` : undefined}
      />

      <div className="space-y-8 mt-8">
        
        {/* Grouped Time Blocks - HERO SECTION */}
        {timeBlocks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-light text-gray-800 flex items-center gap-2">
                <Clock className="w-6 h-6 text-gray-600" />
                Time Blocks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {timeBlocks.map((block, index) => {
                  const category = getCategoryForScore(block.score);
                  const Icon = category.icon;
                  
                  return (
                    <div key={index} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        <Icon className={`w-5 h-5 ${category.color}`} />
                        <div>
                          <div className="font-medium text-gray-900">
                            {formatTimeRange(block.startHour, block.endHour)}
                          </div>
                          <div className="text-sm text-gray-600">{category.label}</div>
                        </div>
                        {block.band && <BandBadge band={block.band} />}
                      </div>
                      <ScoreBadge score={block.score} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Overview */}
        {Object.keys(categoryBreakdown).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-light text-gray-800 flex items-center gap-2">
                <List className="w-6 h-6 text-gray-600" />
                Activity Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(categoryBreakdown).map(([label, data]: [string, CategoryData]) => {
                  const Icon = data.icon;
                  return (
                    <div key={label} className="p-4 rounded-lg border border-gray-200 bg-gray-50/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-5 h-5 ${data.color}`} />
                        <span className="font-medium text-gray-900">{label}</span>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        {data.hours} {data.hours === 1 ? 'hour' : 'hours'} available
                      </div>
                      {label === 'Deep Work' && (
                        <p className="text-xs text-gray-500">Complex tasks, strategic thinking, creative work</p>
                      )}
                      {label === 'Quick Tasks' && (
                        <p className="text-xs text-gray-500">Meetings, emails, routine work, collaboration</p>
                      )}
                      {label === 'Flexible' && (
                        <p className="text-xs text-gray-500">Average energy, adapt to what's needed</p>
                      )}
                      {label === 'Caution' && (
                        <p className="text-xs text-gray-500">Rest, simple tasks, avoid major decisions</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}


      </div>
    </div>
  );
};
