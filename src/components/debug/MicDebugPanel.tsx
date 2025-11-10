import { useState, useEffect, useRef } from 'react';

interface DebugLog {
  timestamp: number;
  message: string;
  type: 'info' | 'warn' | 'error' | 'success';
}

export const MicDebugPanel = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const maxLogs = 100;

  useEffect(() => {
    // Intercept console.log to capture mic-related logs
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const captureLog = (type: 'info' | 'warn' | 'error', ...args: unknown[]) => {
      const message = args.map(arg => {
        if (typeof arg === 'string') return arg;
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      // Only capture mic/VAD/Bluetooth related logs
      const isMicRelated = 
        message.includes('[UniversalSTTRecorder]') ||
        message.includes('[VAD]') ||
        message.includes('[BluetoothAudioPlugin]') ||
        message.includes('Bluetooth') ||
        message.includes('baseline') ||
        message.includes('silence') ||
        message.includes('threshold') ||
        message.includes('rms') ||
        message.includes('SCO') ||
        message.includes('SCO connected') ||
        message.includes('SCO ready') ||
        message.includes('audio routing') ||
        message.includes('Bluetooth connection status');
      
      if (isMicRelated) {
        setLogs(prev => {
          const newLogs = [
            ...prev,
            {
              timestamp: Date.now(),
              message: message.trim(),
              type: type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'info'
            }
          ].slice(-maxLogs);
          return newLogs;
        });
        
        // Update recording state based on log content
        if (message.includes('recording') || message.includes('started')) {
          setIsRecording(true);
        } else if (message.includes('stopped') || message.includes('finalizing')) {
          setIsRecording(false);
        }
      }
      
      // Call original console method
      if (type === 'error') {
        originalError.apply(console, args);
      } else if (type === 'warn') {
        originalWarn.apply(console, args);
      } else {
        originalLog.apply(console, args);
      }
    };

    console.log = (...args: any[]) => captureLog('info', ...args);
    console.warn = (...args: any[]) => captureLog('warn', ...args);
    console.error = (...args: any[]) => captureLog('error', ...args);

    // Monitor recording state via DOM (fallback)
    const checkRecording = () => {
      const micButton = document.querySelector('[data-mic-recording]');
      const recordingIndicator = document.querySelector('[aria-label*="recording" i]');
      setIsRecording(micButton !== null || recordingIndicator !== null);
    };
    
    const observer = new MutationObserver(checkRecording);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    checkRecording();

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const copyLogs = () => {
    const logText = logs.map(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      return `[${time}] ${log.message}`;
    }).join('\n');
    
    navigator.clipboard.writeText(logText).then(() => {
      // Show temporary success message
      const successLog: DebugLog = {
        timestamp: Date.now(),
        message: '✅ Logs copied to clipboard!',
        type: 'success'
      };
      setLogs(prev => [...prev.slice(-maxLogs + 1), successLog]);
    });
  };

  const clearLogs = () => {
    setLogs([]);
  };

  if (!isVisible) {
    // Floating toggle button
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-light shadow-lg hover:bg-gray-800 transition-colors"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        🎤 Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-96 max-h-[600px] bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col font-light"
         style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎤</span>
          <h3 className="text-sm font-light">Mic Debug</h3>
          {isRecording && (
            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
              REC
            </span>
          )}
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 text-xs">
        {logs.length === 0 ? (
          <div className="text-gray-400 italic text-center py-8">
            No mic debug logs yet...
          </div>
        ) : (
          logs.map((log, idx) => {
            const time = new Date(log.timestamp).toLocaleTimeString();
            const colorClass = 
              log.type === 'error' ? 'text-red-600' :
              log.type === 'warn' ? 'text-yellow-600' :
              log.type === 'success' ? 'text-green-600' :
              'text-gray-700';
            
            return (
              <div key={idx} className={`font-mono ${colorClass}`}>
                <span className="text-gray-400">[{time}]</span> {log.message}
              </div>
            );
          })
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Footer Actions */}
      <div className="flex gap-2 p-4 border-t border-gray-200">
        <button
          onClick={copyLogs}
          className="flex-1 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm hover:bg-gray-800 transition-colors"
        >
          Copy Logs
        </button>
        <button
          onClick={clearLogs}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

