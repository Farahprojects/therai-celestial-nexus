import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Sparkles, MessageCircle, Mic, FileText } from 'lucide-react';
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
            <div className="w-full max-w-3xl mx-auto">
              {/* Header Text */}
              <div className="text-center mb-12">
                <h1 className="text-5xl sm:text-6xl font-light text-gray-900 tracking-tight mb-6">
                  Experience The Full App
                </h1>
                <p className="text-xl text-gray-600 font-light max-w-2xl mx-auto">
                  Everything you need to explore your cosmic blueprint
                </p>
              </div>

              {/* Experience Package */}
              <div className="bg-gray-50 rounded-3xl p-10 mb-10 max-w-xl mx-auto">
                <div className="text-center mb-8">
                  <div className="text-6xl font-light text-gray-900 mb-2">$5</div>
                  <div className="text-base text-gray-500">50 credits • Never expires • Top up anytime</div>
                </div>

                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="bg-white rounded-full p-2.5 shadow-sm">
                      <FileText className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="text-base font-medium text-gray-900 mb-1">
                        Generate your complete report
                      </div>
                      <div className="text-sm text-gray-600">
                        Full astrological sync and personalized insights
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="bg-white rounded-full p-2.5 shadow-sm">
                      <Mic className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="text-base font-medium text-gray-900 mb-1">
                        20+ voice conversations
                      </div>
                      <div className="text-sm text-gray-600">
                        Natural, flowing dialogue with AI guidance
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="bg-white rounded-full p-2.5 shadow-sm">
                      <MessageCircle className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="text-base font-medium text-gray-900 mb-1">
                        25+ chat messages
                      </div>
                      <div className="text-sm text-gray-600">
                        Deep dive into any aspect of your chart
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="bg-white rounded-full p-2.5 shadow-sm">
                      <Sparkles className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="text-base font-medium text-gray-900 mb-1">
                        AI insights that create momentum
                      </div>
                      <div className="text-sm text-gray-600">
                        Help self-discovery and growth
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="text-center">
                <Button
                  onClick={() => setShowPurchaseModal(true)}
                  className="bg-gray-900 text-white hover:bg-gray-800 rounded-full px-16 py-7 text-xl font-light shadow-lg hover:shadow-xl transition-shadow"
                >
                  Get Started - $5
                </Button>
                <p className="text-sm text-gray-500 mt-6 font-light">
                  No subscription • No recurring charges • Just pure exploration
                </p>
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className="py-4 text-center text-sm text-gray-400 font-light border-t border-gray-100">
            <div className="max-w-4xl mx-auto px-4">
              <p className="text-xs">
                Secure payment via Stripe • Credits never expire • Top up anytime
              </p>
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
