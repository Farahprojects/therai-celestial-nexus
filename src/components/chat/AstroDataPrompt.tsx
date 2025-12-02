import React from 'react';
import { X, Sparkles, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AstroDataPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAstroData: () => void;
  onContinueWithout: () => void;
}

export const AstroDataPrompt: React.FC<AstroDataPromptProps> = ({
  isOpen,
  onClose,
  onAddAstroData,
  onContinueWithout,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-medium text-gray-900">Welcome to Your Chat</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <MessageCircle className="w-8 h-8 text-blue-600" />
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                How would you like to start?
              </h3>
              <p className="text-sm text-gray-600">
                Choose whether to add your astrological data for personalized insights or continue with a general chat experience.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Add Astro Data Option */}
            <Button
              onClick={onAddAstroData}
              className="w-full py-3 text-base font-light bg-blue-600 text-white hover:bg-blue-700 transition-all duration-300 rounded-lg flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Add Astro Data
            </Button>
            
            {/* Continue Without Option */}
            <Button
              onClick={onContinueWithout}
              variant="outline"
              className="w-full py-3 text-base font-light border-gray-300 text-gray-700 hover:bg-gray-50 transition-all duration-300 rounded-lg"
            >
              Continue Without Astro Data
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              You can always add astro data later from the settings menu
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
