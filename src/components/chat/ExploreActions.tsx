import React, { useState } from 'react';
import { LayoutGrid, Blend, Sparkles, Orbit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatCreation } from '@/components/chat/ChatCreationProvider';

export const ExploreActions: React.FC = () => {
  const { openInsightsFlow, startTogetherMode, openAstroFlow } = useChatCreation();
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="space-y-0">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-light text-gray-900 transition-colors hover:bg-gray-100"
        aria-expanded={isExpanded}
      >
        <LayoutGrid className="h-4 w-4" />
        Explore
      </button>

      {isExpanded && (
        <div className="space-y-0 pl-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-1.5 px-3 py-1 text-sm font-light h-auto"
            onClick={openAstroFlow}
          >
            <Orbit className="h-4 w-4" />
            Astro
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-1.5 px-3 py-1 text-sm font-light h-auto"
            onClick={openInsightsFlow}
          >
            <Sparkles className="h-4 w-4" />
            Generate Insight
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-1.5 px-3 py-1 text-sm font-light h-auto"
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

