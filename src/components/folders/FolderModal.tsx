import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateFolder: (name: string) => void;
  editingFolder?: { id: string; name: string } | null;
}

export const FolderModal: React.FC<FolderModalProps> = ({
  isOpen,
  onClose,
  onCreateFolder,
  editingFolder,
}) => {
  const [folderName, setFolderName] = useState('');

  // Update folderName when editingFolder changes or modal opens
  React.useEffect(() => {
    if (isOpen && editingFolder) {
      setFolderName(editingFolder.name);
    } else if (isOpen && !editingFolder) {
      setFolderName('');
    }
  }, [isOpen, editingFolder]);

  const handleCreate = () => {
    if (folderName.trim()) {
      onCreateFolder(folderName.trim());
      // Reset form
      setFolderName('');
      onClose();
    }
  };

  const handleClose = () => {
    // Reset form
    setFolderName('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingFolder ? 'Rename Folder' : 'Create New Folder'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && folderName.trim()) {
                  handleCreate();
                }
              }}
              placeholder="Enter folder name"
              className="rounded-xl"
              autoFocus
            />
          </div>
          
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={handleClose} className="rounded-full">
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!folderName.trim()}
              className="rounded-full bg-gray-900 hover:bg-gray-800 text-white"
            >
              {editingFolder ? 'Save' : 'Create Folder'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

