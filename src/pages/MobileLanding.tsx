import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FcGoogle } from 'react-icons/fc';
import { FaApple } from 'react-icons/fa';
import { Star, Clock, Shield, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { CapacitorSocialLogin } from '@/components/auth/CapacitorSocialLogin';
import { useIsNativeApp } from '@/hooks/use-native-app';
import Logo from '@/components/Logo';

import { useAuth } from '@/contexts/AuthContext';
import { getRedirectPath } from '@/utils/redirectUtils';

type Props = {
  onGoogle?: () => void;
  onApple?: () => void;
};

const MobileLanding: React.FC<Props> = ({ onGoogle, onApple }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading, signInWithGoogle, signInWithApple } = useAuth();
  const { isAuthModalOpen, openAuthModal, closeAuthModal, authModalMode } = useAuthModal();
  const isNativeApp = useIsNativeApp();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Debug: Log which auth buttons we're showing
  useEffect(() => {
    console.log('[MobileLanding] isNativeApp:', isNativeApp);
    console.log('[MobileLanding] Will show:', isNativeApp ? 'Capacitor buttons' : 'Web buttons');
  }, [isNativeApp]);

  // Rotating words for the "Your..." animation - same as desktop
  const rotatingWords = ['Self', 'Mind', 'Bae', 'Soul', 'Will'];
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  // Word rotation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWordIndex((prev) => (prev + 1) % rotatingWords.length);
    }, 3000); // Change word every 3 seconds

    return () => clearInterval(interval);
  }, [rotatingWords.length]);

  const handleSocialLoginSuccess = () => {
    // Social login completed successfully - check for redirect param
    const redirectPath = getRedirectPath(searchParams);
    const destination = redirectPath || '/therai';
    navigate(destination);
  };

  // Redirect authenticated users to chat
  if (!loading && user) {
    const redirectPath = getRedirectPath(searchParams);
    const destination = redirectPath || '/therai';
    return <Navigate to={destination} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Logo in top left */}
      <div className="absolute top-6 left-5 z-20">
        <Logo size="sm" />
      </div>
      
      {/* Burger menu in top right */}
      <div className="absolute top-6 right-5 z-20">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="text-gray-700 focus:outline-none"
        >
          {isMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>
      
      {/* Mobile Menu - Slide in from right */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30 bg-black/50"
              onClick={() => setIsMenuOpen(false)}
            />
            
            {/* Side menu */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-64 z-40 bg-white shadow-xl"
            >
              <div className="p-5 pt-20">
                {/* Close button */}
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="absolute top-6 right-5 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
                
                {/* Menu items */}
                <div className="space-y-2">
                  <Link 
                    to="/pricing" 
                    className="block text-gray-700 hover:text-gray-900 transition-colors py-3 text-lg font-light"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Pricing
                  </Link>
                  <Link 
                    to="/about" 
                    className="block text-gray-700 hover:text-gray-900 transition-colors py-3 text-lg font-light"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    About
                  </Link>
                  <Link 
                    to="/blog" 
                    className="block text-gray-700 hover:text-gray-900 transition-colors py-3 text-lg font-light"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Blog
                  </Link>
                  <Link 
                    to="/contact" 
                    className="block text-gray-700 hover:text-gray-900 transition-colors py-3 text-lg font-light"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Contact
                  </Link>
                  <Link 
                    to="/legal" 
                    className="block text-gray-700 hover:text-gray-900 transition-colors py-3 text-lg font-light"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Legal
                  </Link>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Hero Section - Same as desktop */}
      <section className="relative flex-1 flex items-center justify-center bg-white overflow-hidden px-4">
        <div className="relative z-10 w-full text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <h1 className="text-5xl font-light text-gray-900 leading-tight mb-8">
              Know
              <br />
              <span className="italic font-medium flex items-center justify-center gap-x-4 flex-wrap">
                <span>Your</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={currentWordIndex}
                    initial={{ opacity: 0, rotateX: 90 }}
                    animate={{ opacity: 1, rotateX: 0 }}
                    exit={{ opacity: 0, rotateX: -90 }}
                    transition={{ duration: 0.3 }}
                    className="inline-block text-left min-w-[4rem] overflow-visible transform-gpu"
                    style={{
                      willChange: 'transform',
                      backfaceVisibility: 'hidden'
                    }}
                  >
                    {rotatingWords[currentWordIndex]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </h1>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mb-16"
          >
            <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
              Psychological insights that create momentum
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.6 }}
            className="flex justify-center items-center gap-6 text-sm text-gray-500 font-medium mb-12"
          >
            <div className="flex items-center gap-2 group">
              <Star className="h-4 w-4 transition-transform group-hover:scale-110" />
              <span>Analyse</span>
            </div>
            <div className="flex items-center gap-2 group">
              <Clock className="h-4 w-4 transition-transform group-hover:scale-110" />
              <span>Instant</span>
            </div>
            <div className="flex items-center gap-2 group">
              <Shield className="h-4 w-4 transition-transform group-hover:scale-110" />
              <span>Private</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Auth (black) */}
      <section className="mt-auto bg-black text-white px-5 pt-8 pb-10 rounded-t-3xl">
        <div className="space-y-3">
          {isNativeApp ? (
            <CapacitorSocialLogin onSuccess={handleSocialLoginSuccess} />
          ) : (
            <>
              <Button
                type="button"
                className="w-full h-12 rounded-full bg-white text-black hover:bg-white/90"
                onClick={async () => {
                  await signInWithGoogle();
                  handleSocialLoginSuccess();
                }}
              >
                <FcGoogle className="mr-2 h-5 w-5" />
                Continue with Google
              </Button>
              
              <Button
                type="button"
                className="w-full h-12 rounded-full bg-white text-black hover:bg-white/90"
                onClick={async () => {
                  await signInWithApple();
                  handleSocialLoginSuccess();
                }}
              >
                <FaApple className="mr-2 h-5 w-5" />
                Continue with Apple
              </Button>
            </>
          )}

          <Button
            type="button"
            className="w-full h-12 rounded-full bg-white/0 text-white border border-white hover:bg-white/10"
            onClick={() => openAuthModal('login')}
          >
            Log in
          </Button>
        </div>
      </section>

      {/* Mobile Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        defaultMode={authModalMode}
      />
    </div>
  );
};

export default MobileLanding;
