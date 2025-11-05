import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LogoutConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutConfirmationDialog({ 
  isOpen, 
  onClose, 
  onConfirm 
}: LogoutConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-light text-lg">Log out</DialogTitle>
          <DialogDescription className="font-light text-gray-600">
            Are you sure you want to log out?
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-row space-x-3 pt-4">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 font-light bg-white text-black border-black hover:bg-gray-50 rounded-full"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 font-light bg-black text-white hover:bg-gray-800 rounded-full"
          >
            Log out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
