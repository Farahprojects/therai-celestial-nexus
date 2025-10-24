import React, { useState } from 'react';
import { X, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SwissDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  swissData: any | null;
  isLoading: boolean;
  error: string | null;
  chartType?: string;
}

export const SwissDataModal: React.FC<SwissDataModalProps> = ({
  isOpen,
  onClose,
  swissData,
  isLoading,
  error,
  chartType = 'Swiss Data',
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      const dataString = JSON.stringify(swissData, null, 2);
      await navigator.clipboard.writeText(dataString);
      setCopied(true);
      toast.success('Swiss data copied to clipboard!');
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[SwissDataModal] Failed to copy:', err);
      toast.error('Failed to copy data');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-light text-gray-900">
            {isLoading ? 'Generating Swiss Data...' : error ? 'Generation Failed' : 'Swiss Data Ready'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-gray-400 animate-spin mb-4" />
              <p className="text-gray-600 font-light">
                Generating your {chartType} data...
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This usually takes a few seconds
              </p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-gray-900 font-medium mb-2">Generation Failed</p>
              <p className="text-sm text-gray-600 text-center max-w-md">
                {error}
              </p>
            </div>
          )}

          {swissData && !isLoading && !error && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-2 font-light">
                  Your Swiss ephemeris data is ready! Copy it and paste into your favorite AI tool.
                </p>
              </div>

              {/* Data Preview */}
              <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-auto">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(swissData, null, 2)}
                </pre>
              </div>

              {/* Copy Button */}
              <Button
                onClick={handleCopy}
                className="w-full h-12 rounded-full bg-gray-900 hover:bg-gray-800 text-white font-light"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5 mr-2" />
                    Copy Swiss Data
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-500 text-center font-light">
                This data is saved to your profile and can be accessed anytime
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (
          <div className="p-6 border-t border-gray-200">
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full h-12 rounded-full font-light"
            >
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

