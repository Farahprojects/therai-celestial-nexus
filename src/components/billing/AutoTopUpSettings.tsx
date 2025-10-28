import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const CREDIT_PRICE = 0.15;
const TOPUP_OPTIONS = [
  { amount: 5, credits: Math.floor(5 / CREDIT_PRICE) },
  { amount: 10, credits: Math.floor(10 / CREDIT_PRICE) },
  { amount: 25, credits: Math.floor(25 / CREDIT_PRICE) },
  { amount: 50, credits: Math.floor(50 / CREDIT_PRICE) },
];

interface AutoTopUpSettingsProps {
  onSettingsChange?: () => void;
}

export const AutoTopUpSettings: React.FC<AutoTopUpSettingsProps> = ({ onSettingsChange }) => {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(7); // ~$1
  const [amount, setAmount] = useState(34); // $5 worth
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('auto_topup_enabled, auto_topup_threshold, auto_topup_amount')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setEnabled(data.auto_topup_enabled ?? false);
        setThreshold(data.auto_topup_threshold ?? 7);
        setAmount(data.auto_topup_amount ?? 34);
      }
    } catch (error) {
      console.error('Error loading auto top-up settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('update_auto_topup_settings', {
        _user_id: user.id,
        _enabled: enabled,
        _threshold: threshold,
        _amount: amount,
      });

      if (error) {
        toast.error('Failed to save settings');
        return;
      }

      toast.success('Auto top-up settings saved');
      onSettingsChange?.();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-32" />
        <div className="h-20 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Auto Top-Up</h3>
          <p className="text-sm text-gray-600 mt-1">
            Automatically purchase credits when balance is low
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {enabled && (
        <>
          {/* Threshold Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-900">
                Trigger Threshold
              </label>
              <span className="text-sm text-gray-600">
                {threshold} credits (${(threshold * CREDIT_PRICE).toFixed(2)})
              </span>
            </div>
            <Slider
              value={[threshold]}
              onValueChange={(values) => setThreshold(values[0])}
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Top-up will trigger when your balance drops to or below this amount
            </p>
          </div>

          {/* Top-Up Amount Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-900">
              Top-Up Amount
            </label>
            <div className="grid grid-cols-2 gap-3">
              {TOPUP_OPTIONS.map((option) => (
                <button
                  key={option.amount}
                  onClick={() => setAmount(option.credits)}
                  className={`
                    rounded-xl border-2 p-3 transition-all text-center
                    ${
                      amount === option.credits
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="text-lg font-light text-gray-900">${option.amount}</div>
                  <div className="text-xs text-gray-600 mt-1">{option.credits} credits</div>
                </button>
              ))}
            </div>
          </div>

          {/* Example */}
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-sm text-gray-700">
              <span className="font-medium">Example:</span> When your balance drops to{' '}
              {threshold} credits or less, we'll automatically charge your card ${(amount * CREDIT_PRICE).toFixed(2)}{' '}
              and add {amount} credits to your account.
            </p>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-full font-light py-6"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </>
      )}

      {!enabled && (
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white rounded-full font-light py-6"
        >
          Save Settings
        </Button>
      )}
    </div>
  );
};

