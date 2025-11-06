import React, { useState } from 'react';
import { LayoutGrid, Blend, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatCreation } from '@/components/chat/ChatCreationProvider';

export const ExploreActions: React.FC = () => {
  const { openInsightsFlow, startTogetherMode } = useChatCreation();
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-light text-gray-900 transition-colors hover:bg-gray-100"
        aria-expanded={isExpanded}
      >
        <LayoutGrid className="h-4 w-4" />
        Explore
      </button>

      {isExpanded && (
        <div className="space-y-1 pl-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-3 py-1.5 text-sm font-light"
            onClick={openInsightsFlow}
          >
            <Sparkles className="h-4 w-4" />
            Generate Insight
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 px-3 py-1.5 text-sm font-light"
            onClick={() => { void startTogetherMode(); }}
          >
            <Blend className="h-4 w-4" />
            Together Mode
          </Button>
        </div>
      )}
    </div>
  );
};

