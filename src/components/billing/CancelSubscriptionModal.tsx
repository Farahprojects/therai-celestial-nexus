import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentPeriodEnd?: string | null;
}

export const CancelSubscriptionModal: React.FC<CancelSubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentPeriodEnd,
}) => {
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        body: { cancelImmediately },
      });

      if (error) {
        toast.error('Failed to cancel subscription');
        return;
      }

      if (cancelImmediately) {
        toast.success('Subscription canceled immediately');
      } else {
        toast.success('Subscription will cancel at the end of your billing period');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Cancel subscription error:', err);
      toast.error('Failed to cancel subscription');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'the end of your billing period';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md font-inter">
        <DialogHeader>
          <DialogTitle className="text-xl font-light text-gray-900">Cancel Subscription</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-normal text-amber-900">
                You'll lose access to all premium features
              </p>
              <p className="text-sm font-light text-amber-800">
                This includes reports, insights, and chat history.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-light text-gray-600">When should we cancel your subscription?</p>
            
            <div className="space-y-2">
              <button
                onClick={() => setCancelImmediately(false)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  !cancelImmediately
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-normal text-gray-900">
                  At period end
                  <span className="text-xs font-light text-gray-500 block mt-1">
                    Access until {formatDate(currentPeriodEnd)}
                  </span>
                </p>
              </button>

              <button
                onClick={() => setCancelImmediately(true)}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                  cancelImmediately
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-sm font-normal text-gray-900">
                  Cancel immediately
                  <span className="text-xs font-light text-gray-500 block mt-1">
                    Access ends right now
                  </span>
                </p>
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={onClose}
              variant="outline"
              disabled={loading}
              className="flex-1 rounded-full border-gray-300 text-gray-900 hover:bg-gray-50 font-light"
            >
              Keep Subscription
            </Button>
            <Button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-light"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Canceling...
                </>
              ) : (
                'Confirm Cancel'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

