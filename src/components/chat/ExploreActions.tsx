import React, { useState } from 'react';
import { Blend, Drama } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatCreation } from '@/components/chat/ChatCreationProvider';

export const ExploreActions: React.FC = () => {
  const { startTogetherMode, openSyncScoreFlow } = useChatCreation();
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="space-y-0 mt-2">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex w-full items-center px-3 py-1 text-xs text-gray-600 font-medium"
        aria-expanded={isExpanded}
      >
        Explore
      </button>

      {isExpanded && (
        <div className="space-y-0 pl-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-1.5 px-3 py-1 text-sm font-light h-auto"
            onClick={() => { void startTogetherMode(); }}
          >
            <Blend className="h-4 w-4" />
            Together Mode
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-1.5 px-3 py-1 text-sm font-light h-auto"
            onClick={openSyncScoreFlow}
          >
            <Drama className="h-4 w-4" />
            Meme
          </Button>
        </div>
      )}
    </div>
  );
};

