import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { CreditPurchaseModal } from '@/components/billing/CreditPurchaseModal';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const PaywallModal: React.FC<PaywallModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [showPurchaseModal, setShowPurchaseModal] = React.useState(false);

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-white z-50 flex flex-col"
        >
          {/* Header */}
          <header className="w-full py-4 flex justify-end items-center px-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </Button>
          </header>

          {/* Main Content */}
          <main className="flex-grow overflow-y-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="w-full max-w-4xl mx-auto">
              {/* Header Text */}
              <div className="text-center mb-12">
                <h1 className="text-3xl font-light text-gray-900 tracking-tight mb-4">
                  Top Up Credits
                </h1>
                <p className="text-lg text-gray-600 font-light max-w-2xl mx-auto">
                  Purchase credits to continue your journey
                </p>
              </div>

              {/* Credit Info */}
              <div className="bg-gray-50 rounded-xl p-8 mb-8 max-w-2xl mx-auto">
                <div className="text-center mb-6">
                  <div className="text-4xl font-light text-gray-900 mb-2">$0.15</div>
                  <div className="text-sm text-gray-600">per credit</div>
                </div>

                <div className="space-y-3 text-sm text-gray-600">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span>Chat Message</span>
                    <span className="text-gray-900 font-medium">1 credit</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span>Voice Conversation</span>
                    <span className="text-gray-900 font-medium">3 credits</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span>Astro Data</span>
                    <span className="text-gray-900 font-medium">1-4 credits</span>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="text-center">
                <Button
                  onClick={() => setShowPurchaseModal(true)}
                  className="bg-gray-900 text-white hover:bg-gray-800 rounded-full px-12 py-6 text-lg font-light"
                >
                  Purchase Credits
                </Button>
                <p className="text-sm text-gray-500 mt-4">
                  Minimum purchase: $5 (33 credits)
                </p>
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className="py-3 text-center text-sm text-gray-500 font-light border-t border-gray-100">
            <div className="max-w-4xl mx-auto px-4">
              <p className="mb-2">© {new Date().getFullYear()} Therai. All rights reserved.</p>
              <div className="text-xs text-gray-400">
                <p>Secure payment processed by Stripe. Credits never expire.</p>
              </div>
            </div>
          </footer>
        </motion.div>
      </AnimatePresence>

      <CreditPurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => {
          setShowPurchaseModal(false);
          onSuccess?.();
          onClose();
        }}
      />
    </>
  );
};

export default PaywallModal;
