import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles } from 'lucide-react';

interface SwissSubscriptionGuardProps {
  children: React.ReactNode;
}

/**
 * SwissSubscriptionGuard - Protects Swiss data generation features
 * 
 * Checks for active $25/year subscription
 * Shows paywall if user doesn't have access
 */
export const SwissSubscriptionGuard: React.FC<SwissSubscriptionGuardProps> = ({ children }) => {
  const { isActive, plan, loading } = useSubscriptionStatus();
  const navigate = useNavigate();

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="text-sm text-gray-600">Checking subscription...</p>
        </div>
      </div>
    );
  }

  // Check if user has valid subscription
  // TODO: Update this check when user provides specific product ID for $25/year plan
  const hasSwissAccess = isActive && (
    plan?.includes('25') || 
    plan?.includes('swiss') || 
    plan?.includes('yearly')
  );

  // Show paywall if no access
  if (!hasSwissAccess) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100">
            <Lock className="w-8 h-8 text-gray-600" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-light text-gray-900">Swiss Data Generator</h2>
            <p className="text-gray-600">
              Generate and export Swiss data for use in your preferred AI tools.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-center gap-2 text-gray-900">
              <Sparkles className="w-5 h-5" />
              <span className="text-lg font-medium">$25/year</span>
            </div>
            <ul className="text-sm text-gray-600 space-y-2 text-left">
              <li className="flex items-start gap-2">
                <span className="text-gray-900">•</span>
                <span>Generate unlimited Swiss data</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-900">•</span>
                <span>Save and organize your datasets</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-900">•</span>
                <span>Copy and export to any AI tool</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={() => navigate('/subscription')}
            className="w-full bg-gray-900 text-white hover:bg-gray-800 rounded-lg py-3"
          >
            Subscribe Now
          </Button>

          <p className="text-xs text-gray-500">
            Already subscribed? Your subscription may be processing.
          </p>
        </div>
      </div>
    );
  }

  // User has access, render children
  return <>{children}</>;
};

