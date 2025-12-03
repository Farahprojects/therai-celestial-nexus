import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AstroDataForm } from './AstroDataForm';
import { ReportFormData } from '@/types/report-form';

interface AstroDataPromptMessageProps {
  onAddAstroData: () => void;
}

export const AstroDataPromptMessage: React.FC<AstroDataPromptMessageProps> = ({
  onAddAstroData,
}) => {
  const [showForm, setShowForm] = useState(false);

  const handleAddAstroData = () => {
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
  };

  const handleFormSubmit = (data: ReportFormData & { chat_id?: string }) => {
    console.log('Astro data submitted:', data);
    
    if (data.chat_id) {
      // Success! We have a chat_id
      console.log('Success data:', {
        chat_id: data.chat_id
      });
      
      // TODO: Store these in the chat store or context
      // For now, just show success and close form
      setShowForm(false);
      onAddAstroData();
    } else {
      console.error('Missing chat_id from form submission');
    }
  };

  if (showForm) {
    return (
      <div className="flex items-start justify-start mb-8">
        <div className="w-full max-w-2xl lg:max-w-4xl">
          <AstroDataForm
            onClose={handleFormClose}
            onSubmit={handleFormSubmit}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-start mb-8">
      {/* Message Content */}
      <div className="px-4 py-3 rounded-2xl max-w-2xl lg:max-w-4xl text-black">
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleAddAstroData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors rounded-lg"
          >
            <Sparkles className="w-4 h-4" />
            Add Astro Data
          </Button>
        </div>
      </div>
    </div>
  );
};
