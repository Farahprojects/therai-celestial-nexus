import React from 'react';
import { Button } from '@/components/ui/button';
import { FolderPlus } from 'lucide-react';

interface AddFolderButtonProps {
  onClick: () => void;
  className?: string;
}

export const AddFolderButton: React.FC<AddFolderButtonProps> = ({ 
  onClick, 
  className
}) => {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      className={`w-full flex items-center justify-start gap-2 px-3 py-1 text-sm text-black hover:bg-gray-100 rounded-lg transition-colors font-light ${className || ''}`}
    >
      <FolderPlus className="w-4 h-4" />
      New Folder
    </Button>
  );
};

