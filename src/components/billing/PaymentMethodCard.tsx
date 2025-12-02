import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentMethodCardProps {
  brand?: string | null;
  lastFour?: string | null;
}

export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({ brand, lastFour }) => {
  const [loading, setLoading] = useState(false);

  const openCustomerPortal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) {
        toast.error('Failed to open billing portal');
        return;
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch {
      toast.error('Failed to open billing portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border border-gray-200 rounded-xl">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-light text-gray-600">Payment Method</p>
              {brand && lastFour ? (
                <p className="text-base font-normal text-gray-900 mt-1">
                  {brand.charAt(0).toUpperCase() + brand.slice(1)} •••• {lastFour}
                </p>
              ) : (
                <p className="text-base font-light text-gray-400 mt-1">No payment method on file</p>
              )}
            </div>
          </div>
          <Button
            onClick={openCustomerPortal}
            disabled={loading}
            variant="outline"
            className="rounded-full border-gray-300 text-gray-900 hover:bg-gray-50 font-light"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Update'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

