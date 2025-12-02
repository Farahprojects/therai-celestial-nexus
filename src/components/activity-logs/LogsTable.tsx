
import React from 'react';
import { format } from 'date-fns';
import { Check, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isFailedLog, formatTypeValue } from './formatters';

type ActivityLog = {
  id: string;
  created_at: string;
  response_status: number;
  request_type: string;
  endpoint?: string;
  report_tier: string | null;
  total_cost_usd: number;
  processing_time_ms: number | null;
  response_payload?: unknown;
  request_payload?: unknown;
  error_message?: string;
  google_geo?: boolean;
};

interface LogsTableProps {
  logs: ActivityLog[];
  loading: boolean;
  isMobile: boolean;
  onRowClick: (log: ActivityLog) => void;
}

const LogsTable = ({ logs, loading, isMobile, onRowClick }: LogsTableProps) => {
  // Render status icon with tooltip
  const renderStatusIcon = (status: number) => {
    if (status >= 200 && status < 300) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
              <Check className="h-4 w-4 text-green-600" />
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-white">
            <p>Success</p>
          </TooltipContent>
        </Tooltip>
      );
    } else {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100">
              <X className="h-4 w-4 text-red-600" />
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-white">
            <p>Failed</p>
          </TooltipContent>
        </Tooltip>
      );
    }
  };

  const handleTypeClick = (log: ActivityLog, event: React.MouseEvent) => {
    console.log('Type cell clicked:', log.id, log.request_type);
    event.stopPropagation();
    onRowClick(log);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-8 text-center">
          <p>Loading activity logs...</p>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-8 text-center">
          <p>No activity logs found.</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Cost</th>
                {/* Hide Time column on mobile */}
                {!isMobile && (
                  <th className="px-4 py-3 text-right">Time</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr 
                  key={log.id} 
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    {log.created_at ? 
                      format(new Date(log.created_at), 'MMM d, yyyy') : 
                      'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    {renderStatusIcon(log.response_status)}
                  </td>
                  <td 
                    className="px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={(event) => handleTypeClick(log, event)}
                  >
                    {isFailedLog(log.response_status) ? (
                      <span className="text-gray-500 text-sm">None</span>
                    ) : (
                      <div className="flex flex-col">
                        <span className="font-medium text-primary hover:underline text-sm">
                          {formatTypeValue(log.request_type)}
                        </span>
                        {log.report_tier && (
                          <span className="text-sm text-primary">
                            {formatTypeValue(log.report_tier)}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    ${log.total_cost_usd?.toFixed(2) || '0.00'}
                  </td>
                  {/* Hide Time column on mobile */}
                  {!isMobile && (
                    <td className="px-4 py-3 text-right">
                      {log.processing_time_ms ? 
                        `${(log.processing_time_ms / 1000).toFixed(2)}s` : 
                        'N/A'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default LogsTable;
