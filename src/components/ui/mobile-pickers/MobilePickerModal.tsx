
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface MobilePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
}

const MobilePickerModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  children 
}: MobilePickerModalProps) => {
  const handleCancelClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Cancel button clicked');
    onClose();
  };

  const handleConfirmClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Done button clicked');
    onConfirm();
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ 
              type: "spring", 
              damping: 35, 
              stiffness: 500,
              duration: 0.2
            }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-xl shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelClick}
                className="text-gray-600 hover:text-gray-800 font-normal min-h-[44px] min-w-[44px]"
                style={{ 
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  WebkitAppearance: 'none'
                }}
              >
                Cancel
              </Button>
              
              <h3 className="text-lg font-semibold text-gray-900">
                {title}
              </h3>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleConfirmClick}
                className="text-blue-600 hover:text-blue-700 font-semibold min-h-[44px] min-w-[44px]"
                style={{ 
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  WebkitAppearance: 'none'
                }}
              >
                Done
              </Button>
            </div>
            
            {/* Content */}
            <div className="p-4 pb-8">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobilePickerModal;
