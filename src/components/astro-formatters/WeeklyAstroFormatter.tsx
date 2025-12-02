import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { ChartHeader } from './shared/ChartHeader';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Calendar, TrendingUp, Activity } from 'lucide-react';

interface TopEvent {
  date: string;
  transit: string;
  aspect: string;
  natal_target: string;
  orb: number;
}

interface DailyScore {
  date: string;
  score: number;
  events: string[];
}

interface WeeklyAstroFormatterProps {
  swissData: Record<string, unknown>;
  reportData: Record<string, unknown>;
  className?: string;
}

const ScoreBadge = ({ score }: { score: number }) => {
  let colorClass = 'bg-gray-200 text-gray-800';
  if (score >= 60) colorClass = 'bg-green-200 text-green-900 font-medium';
  else if (score >= 50) colorClass = 'bg-green-100 text-green-800';
  else if (score >= 40) colorClass = 'bg-blue-100 text-blue-800';
  else if (score < 40) colorClass = 'bg-amber-100 text-amber-800';

  return <Badge className={`text-sm ${colorClass}`}>{score}</Badge>;
};

export const WeeklyAstroFormatter: React.FC<WeeklyAstroFormatterProps> = ({
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
        <p className="text-lg font-light">No weekly outlook data available for this report.</p>
      </div>
    );
  }

  const { peaks, top_events, daily_index } = components;
  
  // Format date range
  const dateRange = meta.range || 'This Week';

  return (
    <div className={`font-inter max-w-4xl mx-auto py-8 ${className}`}>
      <ChartHeader
        name={subject?.name || 'Unknown'}
        title={`Weekly Outlook`}
        subtitle={dateRange}
      />

      <div className="space-y-8 mt-8">
        
        {/* Peak Opportunity Days */}
        {peaks && peaks.dates && peaks.dates.length > 0 && (
          <Card className="border-2 border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="text-2xl font-light text-gray-800 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-green-600" />
                Peak Opportunity Days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                These are the days this week with the highest potential for positive flow and alignment.
              </p>
              <div className="flex flex-wrap gap-2">
                {peaks.dates.map((date: string) => (
                  <Badge key={date} variant="secondary" className="text-md px-3 py-1.5 bg-green-100 text-green-900">
                    {new Date(date).toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Badge>
                ))}
              </div>
              {peaks.max_score && (
                <p className="text-xs text-gray-500 mt-3">
                  Peak score: {peaks.max_score}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Top Astrological Events */}
        {top_events && top_events.items && top_events.items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-light text-gray-800 flex items-center gap-2">
                <Activity className="w-6 h-6 text-gray-600" />
                Key Astrological Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4 text-sm">
                The most significant planetary aspects this week.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs md:text-sm">Date</TableHead>
                      <TableHead className="text-xs md:text-sm">Event</TableHead>
                      <TableHead className="text-right text-xs md:text-sm">Orb</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {top_events.items.map((event: TopEvent, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="whitespace-nowrap text-xs md:text-sm">
                          {new Date(event.date).toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-xs md:text-sm">
                          {`${event.transit} ${event.aspect} ${event.natal_target}`}
                        </TableCell>
                        <TableCell className="text-right text-xs md:text-sm">
                          {event.orb.toFixed(1)}°
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Energy Index */}
        {daily_index && daily_index.scores && daily_index.scores.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-light text-gray-800 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-gray-600" />
                Daily Energy Index
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4 text-sm">
                Your daily cosmic weather forecast for the week ahead.
              </p>
              <Accordion type="single" collapsible className="w-full">
                {daily_index.scores.map((day: DailyScore, index: number) => (
                  <AccordionItem value={`item-${index}`} key={day.date}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex justify-between items-center w-full pr-4">
                        <span className="font-medium text-gray-900">
                          {new Date(day.date).toLocaleDateString('default', { 
                            weekday: 'long', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                        <ScoreBadge score={day.score} />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {day.events && day.events.length > 0 ? (
                        <ul className="list-disc pl-5 text-gray-600 text-sm space-y-1 max-h-64 overflow-y-auto">
                          {day.events.map((event: string, i: number) => (
                            <li key={i}>{event}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500 text-sm">No significant events for this day.</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
};

