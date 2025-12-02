import React, { useState } from 'react';
import { Download, FileText, MessageCircle, Archive } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { exportJournals, exportChats, exportAll } from '@/services/folder-export';
import { toast } from 'sonner';

interface FolderExportMenuProps {
  folderId: string;
  folderName: string;
}

export const FolderExportMenu: React.FC<FolderExportMenuProps> = ({
  folderId,
  folderName,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportJournals = async () => {
    setIsExporting(true);
    try {
      await exportJournals(folderId, folderName);
      toast.success('Journals exported successfully');
    } catch (error) {
      console.error('[FolderExportMenu] Failed to export journals:', error);
      toast.error('Failed to export journals');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportChats = async () => {
    setIsExporting(true);
    try {
      await exportChats(folderId, folderName);
      toast.success('Chats exported successfully');
    } catch (error) {
      console.error('[FolderExportMenu] Failed to export chats:', error);
      toast.error('Failed to export chats');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      await exportAll(folderId, folderName);
      toast.success('All data exported successfully');
    } catch (error) {
      console.error('[FolderExportMenu] Failed to export all data:', error);
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full font-light"
          disabled={isExporting}
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={handleExportJournals}
          disabled={isExporting}
          className="cursor-pointer font-light"
        >
          <FileText className="w-4 h-4 mr-3 text-gray-600" />
          <div className="flex flex-col">
            <span className="text-sm">Export Journals</span>
            <span className="text-xs text-gray-500">Download journal entries</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={handleExportChats}
          disabled={isExporting}
          className="cursor-pointer font-light"
        >
          <MessageCircle className="w-4 h-4 mr-3 text-gray-600" />
          <div className="flex flex-col">
            <span className="text-sm">Export Chats</span>
            <span className="text-xs text-gray-500">Download conversations</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={handleExportAll}
          disabled={isExporting}
          className="cursor-pointer font-light"
        >
          <Archive className="w-4 h-4 mr-3 text-gray-600" />
          <div className="flex flex-col">
            <span className="text-sm">Export All</span>
            <span className="text-xs text-gray-500">Complete folder export</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

