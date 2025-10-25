import React, { useState } from 'react';
import { X } from 'lucide-react';
import LoginModal from './LoginModal';
import SignupModal from './SignupModal';
import { useIsMobile } from '@/hooks/use-mobile';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  defaultMode = 'login' 
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode);
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 ${
      isMobile 
        ? 'bg-white' 
        : 'flex items-center justify-center p-4'
    }`}>
      <div className={`bg-white shadow-xl w-full overflow-hidden ${
        isMobile 
          ? 'h-full rounded-none flex flex-col' 
          : 'rounded-xl max-w-md max-h-[95vh]'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b border-gray-200 ${
          isMobile ? 'p-6 pt-12' : 'p-4'
        }`}>
          <h2 className="text-lg font-medium text-gray-900">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className={`overflow-y-auto ${
          isMobile 
            ? 'flex-1 p-6' 
            : 'p-4 max-h-[calc(90vh-80px)]'
        }`}>
          {mode === 'login' ? (
            <LoginModal onSuccess={onClose} />
          ) : (
            <SignupModal onSuccess={onClose} />
          )}
        </div>

        {/* Mode Toggle */}
        <div className={`border-t border-gray-200 text-center ${
          isMobile ? 'p-6 pb-8' : 'p-4 pb-8'
        }`}>
          {mode === 'login' ? (
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <button
                onClick={() => setMode('signup')}
                className="text-gray-900 hover:text-gray-700 transition-colors border-b border-gray-300 hover:border-gray-600 pb-1"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                onClick={() => setMode('login')}
                className="text-gray-900 hover:text-gray-700 transition-colors border-b border-gray-300 hover:border-gray-600 pb-1"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
