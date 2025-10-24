import React, { useState } from 'react';
import { X, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SwissDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewData?: () => void;
  swissData: any | null;
  isLoading: boolean;
  error: string | null;
  chartType?: string;
}

export const SwissDataModal: React.FC<SwissDataModalProps> = ({
  isOpen,
  onClose,
  onViewData,
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
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <p className="text-center text-gray-700 font-medium mb-2">
                  Your Swiss Data is Ready!
                </p>
                <p className="text-center text-sm text-gray-600 font-light">
                  Choose an option below to continue
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Copy Button */}
                <Button
                  onClick={handleCopy}
                  className="w-full h-14 rounded-full bg-gray-900 hover:bg-gray-800 text-white font-light text-base shadow-lg hover:shadow-xl transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Copied! Now paste into your AI
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5 mr-2" />
                      Copy Astro Data
                    </>
                  )}
                </Button>

                {/* View Button */}
                <Button
                  onClick={onViewData || onClose}
                  variant="outline"
                  className="w-full h-14 rounded-full border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 font-light text-base transition-all"
                >
                  View Astro Data
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center font-light">
                Your data is saved and can be accessed anytime from your conversation history
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

