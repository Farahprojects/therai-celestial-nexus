import React from 'react';
import { Button } from '@/components/ui/button';
import { FolderPlus, ChevronDown, ChevronUp } from 'lucide-react';

interface AddFolderButtonProps {
  onClick: () => void;
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const AddFolderButton: React.FC<AddFolderButtonProps> = ({ 
  onClick, 
  className,
  isExpanded = true,
  onToggleExpand 
}) => {
  return (
    <div className="flex items-center gap-1">
      <Button
        onClick={onClick}
        variant="ghost"
        className={`flex-1 flex items-center justify-start gap-2 px-3 py-1 text-sm text-black hover:bg-gray-100 rounded-lg transition-colors font-light ${className || ''}`}
      >
        <FolderPlus className="w-4 h-4" />
        New Folder
      </Button>
      
      {onToggleExpand && (
        <Button
          onClick={onToggleExpand}
          variant="ghost"
          size="sm"
          className="p-1.5 h-auto hover:bg-gray-100 rounded-lg transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          )}
        </Button>
      )}
    </div>
  );
};

