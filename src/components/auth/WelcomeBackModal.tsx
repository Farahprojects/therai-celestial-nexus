import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface WelcomeBackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToForm: () => void;
}

export const WelcomeBackModal: React.FC<WelcomeBackModalProps> = ({
  isOpen,
  onClose,
  onBackToForm,
}) => {
  const navigate = useNavigate();

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <div className="text-center space-y-4">
          <h3 className="text-2xl font-light text-gray-900">Welcome Back</h3>
          <p className="text-gray-600 font-light">Log in or sign up to know yourself better</p>
          <div className="space-y-3 pt-2">
            <Button
              className="w-full rounded-full bg-gray-900 text-white hover:bg-gray-800"
              onClick={() => {
                onClose();
                navigate('/login');
              }}
            >
              Log in
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-full border-gray-900 text-gray-900 hover:bg-gray-50"
              onClick={() => {
                onClose();
                navigate('/signup');
              }}
            >
              Sign up
            </Button>
            <button
              type="button"
              className="block w-full text-sm text-gray-500 underline underline-offset-4 pt-2"
              onClick={() => {
                onClose();
                onBackToForm();
              }}
            >
              Back to astro form
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
