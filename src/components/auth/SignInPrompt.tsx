import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { User, Sparkles } from 'lucide-react';

interface SignInPromptProps {
  feature: string;
  onClose?: () => void;
}

export const SignInPrompt: React.FC<SignInPromptProps> = ({ feature, onClose }) => {
  const navigate = useNavigate();

  const handleSignIn = () => {
    onClose?.();
    navigate('/login');
  };

  const handleSignUp = () => {
    onClose?.();
    navigate('/signup');
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          
          <div>
            <h3 className="text-lg font-light text-gray-900 mb-2">
              Sign in to access <span className="italic">{feature}</span>
            </h3>
            <p className="text-sm text-gray-600">
              Create an account to unlock advanced features and save your conversation history.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Button 
              onClick={handleSignIn}
              className="w-full bg-gray-900 text-white hover:bg-gray-800 font-light"
            >
              <User className="w-4 h-4 mr-2" />
              Sign In
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleSignUp}
              className="w-full font-light"
            >
              Create Account
            </Button>
            
          </div>
        </div>
      </div>
    </div>
  );
};