
import React from 'react';
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";

interface SocialLoginProps {
  onGoogleSignIn: () => void;
  onAppleSignIn: () => void;
}

const SocialLogin: React.FC<SocialLoginProps> = ({ onGoogleSignIn, onAppleSignIn }) => {
  const handleGoogleSignIn = (e: React.MouseEvent) => {
    e.preventDefault();
    onGoogleSignIn();
  };
  
  const handleAppleSignIn = (e: React.MouseEvent) => {
    e.preventDefault();
    onAppleSignIn();
  };

  return (
    <div className="space-y-4">
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t"></span>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleGoogleSignIn}
          className="flex items-center justify-center rounded-full border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-900 transition-colors duration-200"
        >
          <FcGoogle className="mr-2 h-5 w-5" />
          Google
        </Button>
        
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleAppleSignIn}
          className="flex items-center justify-center rounded-full border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-900 transition-colors duration-200"
        >
          <FaApple className="mr-2 h-5 w-5" />
          Apple
        </Button>
      </div>
    </div>
  );
};

export default SocialLogin;
