import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditPurchaseModal } from '@/components/billing/CreditPurchaseModal';
import { AutoTopUpSettings } from '@/components/billing/AutoTopUpSettings';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const CREDIT_PRICE = 0.15;

interface CreditData {
  credits: number;
  auto_topup_enabled: boolean;
  auto_topup_threshold: number;
  auto_topup_amount: number;
}

interface Transaction {
  id: string;
  type: string;
  credits: number;
  amount_usd: number | null;
  description: string | null;
  created_at: string;
}

export const BillingPanel: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [creditData, setCreditData] = useState<CreditData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  const fetchBillingData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch credit balance and auto top-up settings
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('credits, auto_topup_enabled, auto_topup_threshold, auto_topup_amount')
        .eq('user_id', user.id)
        .maybeSingle();

      if (creditsError && creditsError.code !== 'PGRST116') {
        throw creditsError;
      }

      setCreditData(creditsData || {
        credits: 0,
        auto_topup_enabled: false,
        auto_topup_threshold: 7,
        auto_topup_amount: 34,
      });

      // Fetch transaction history
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!transactionsError && transactionsData) {
        setTransactions(transactionsData);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();

    // Set up real-time subscription for credit balance updates
    if (!user) return;

    const channel = supabase
      .channel('user_credits_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Credit balance updated:', payload);
          // Update credit data with new balance
          if (payload.new && 'credits' in payload.new) {
            setCreditData((prev) => prev ? { ...prev, credits: payload.new.credits } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionLabel = (transaction: Transaction) => {
    switch (transaction.type) {
      case 'purchase':
        return 'Credit Purchase';
      case 'auto_topup':
        return 'Auto Top-Up';
      case 'deduct':
        return transaction.description || 'Credit Used';
      case 'refund':
        return 'Refund';
      default:
        return transaction.type;
    }
  };

  const getTransactionSign = (transaction: Transaction) => {
    return ['purchase', 'auto_topup', 'refund'].includes(transaction.type) ? '+' : '-';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Credit Balance */}
      <div className="text-center py-8 border-b">
        <h3 className="text-sm font-normal text-gray-600 mb-2">Available Credits</h3>
        <div className="text-5xl font-light text-gray-900 mb-2">
          {creditData?.credits || 0}
        </div>
        <div className="text-sm text-gray-600">
          ${((creditData?.credits || 0) * CREDIT_PRICE).toFixed(2)} USD
        </div>
        <Button
          onClick={() => setShowPurchaseModal(true)}
          className="mt-6 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-light px-8"
        >
          <Plus className="w-4 h-4 mr-2" />
          Purchase Credits
        </Button>
      </div>

      {/* Pricing Info */}
      <div className="border-b pb-6">
        <h3 className="text-sm font-normal text-gray-900 mb-4">Credit Pricing</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex justify-between py-2">
            <span>Chat Message</span>
            <span className="text-gray-900">1 credit ($0.15)</span>
          </div>
          <div className="flex justify-between py-2">
            <span>Voice Conversation</span>
            <span className="text-gray-900">3 credits ($0.45)</span>
          </div>
          <div className="flex justify-between py-2">
            <span>Astro Data (Basic)</span>
            <span className="text-gray-900">1 credit ($0.15)</span>
          </div>
          <div className="flex justify-between py-2">
            <span>Sync Chart</span>
            <span className="text-gray-900">2 credits ($0.30)</span>
          </div>
          <div className="flex justify-between py-2">
            <span>Report Generation</span>
            <span className="text-gray-900">2 credits ($0.30)</span>
          </div>
          <div className="flex justify-between py-2">
            <span>Sync + Report</span>
            <span className="text-gray-900">4 credits ($0.60)</span>
          </div>
        </div>
      </div>

      {/* Auto Top-Up Settings */}
      <div className="border-b pb-6">
        <h3 className="text-sm font-normal text-gray-900 mb-4">Auto Top-Up</h3>
        <AutoTopUpSettings onSettingsChange={fetchBillingData} />
      </div>

      {/* Transaction History */}
      <div>
        <Collapsible open={showTransactions} onOpenChange={setShowTransactions}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-3 hover:bg-gray-50 rounded-xl px-4 transition-colors">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-normal text-gray-900">Transaction History</h3>
            </div>
            <span className="text-xs text-gray-600">
              {showTransactions ? 'Hide' : 'Show'} ({transactions.length})
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-4 space-y-2">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No transactions yet
                </div>
              ) : (
                transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    <div className="flex-1">
                      <div className="text-sm text-gray-900">
                        {getTransactionLabel(transaction)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(transaction.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-medium ${
                          getTransactionSign(transaction) === '+'
                            ? 'text-green-600'
                            : 'text-gray-900'
                        }`}
                      >
                        {getTransactionSign(transaction)}
                        {transaction.credits} credits
                      </div>
                      {transaction.amount_usd && (
                        <div className="text-xs text-gray-500 mt-1">
                          ${transaction.amount_usd.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Purchase Modal */}
      <CreditPurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => {
          setShowPurchaseModal(false);
          fetchBillingData();
        }}
      />
    </div>
  );
};
