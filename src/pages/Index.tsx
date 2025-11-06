import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Star, Clock, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UnifiedNavigation from '@/components/UnifiedNavigation';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useLandingPageImages } from '@/hooks/useLandingPageImages';
import { SEO } from '@/components/SEO';

/**
 * Desktop Landing / Index page with Know Your [Self, Mind, Bae, Soul, Will] hero
 */

// Animation helpers
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" },
  }),
};

const Index = () => {
  const { user, loading } = useAuth();
  const { data: imageConfig } = useLandingPageImages();

  // Rotating words for the "Your..." animation
  const rotatingWords = ['Self', 'Mind', 'Bae', 'Soul', 'Will'];
  const [currentWordIndex, setCurrentWordIndex] = useState(0);

  // Word rotation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWordIndex((prev) => (prev + 1) % rotatingWords.length);
    }, 3000); // Change word every 3 seconds

    return () => clearInterval(interval);
  }, [rotatingWords.length]);

  // Redirect authenticated users to chat
  if (!loading && user) {
    return <Navigate to="/therai" replace />;
  }

  return (
    <>
      <SEO
        url="/"
      />
      <div className="flex min-h-screen flex-col bg-white">
        <UnifiedNavigation />

      <main className="flex-grow overflow-hidden">
        {/* Hero Section with Know Your [rotating words] */}
        <section className="relative h-screen w-full flex items-center justify-center bg-white overflow-hidden pt-24">
          {/* Subtle animated background removed for cleaner hero */}

          <div className="relative z-10 w-full md:px-4 md:container md:mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="max-w-5xl mx-auto space-y-12"
            >
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-light text-gray-900 leading-tight">
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
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="mb-16"
              >
                <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
                  Psychological insights that create momentum
                </p>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8, duration: 0.8 }}
                  className="mt-6"
                >
                  <p className="text-2xl md:text-3xl font-light text-gray-900 italic">
                    e ≡ AΦ
                  </p>
                </motion.div>
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

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.0, duration: 0.6 }}
                className="space-y-8"
              >
                <Link to="/signup">
                  <Button 
                    size="lg" 
                    className="bg-primary text-white px-12 py-6 rounded-full text-lg font-medium hover:bg-primary-hover transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                  >
                    Begin Your Journey
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Index;
