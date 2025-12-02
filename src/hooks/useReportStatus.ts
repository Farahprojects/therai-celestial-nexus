
import { useState } from 'react';
import { log } from '@/utils/logUtils';

export type ReportStatus = 
  | 'collecting'
  | 'processing' 
  | 'verifying'
  | 'waiting'
  | 'success'
  | 'error'
  | 'viewing';

interface ReportStatusState {
  status: ReportStatus;
  error: string | null;
  reportData: unknown | null;
}

export const useReportStatus = () => {
  const [state, setState] = useState<ReportStatusState>({
    status: 'collecting',
    error: null,
    reportData: null,
  });

  const setStatus = (status: ReportStatus, error?: string, reportData?: unknown) => {
    setState({
      status,
      error: error || null,
      reportData: reportData || null,
    });
    
    log('debug', 'Report status changed', { status, error }, 'useReportStatus');
  };

  const reset = () => {
    setState({
      status: 'collecting',
      error: null,
      reportData: null,
    });
  };

  return {
    ...state,
    setStatus,
    reset
  };
};
