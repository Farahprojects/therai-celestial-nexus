import React, { useState } from 'react';
import { X, Sparkles, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface ScoreBreakdown {
  overall: number;
  astrological: number;
  breakdown: {
    harmonious_aspects: number;
    challenging_aspects: number;
    weighted_score: number;
    key_connections: string[];
    dominant_theme: string;
  };
  poetic_headline: string;
  ai_insight: string;
  calculated_at: string;
  rarity_percentile: number;
  card_image_url?: string | null;
}

interface SyncScoreResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  score: ScoreBreakdown;
  personAName: string;
  personBName: string;
  onCalculateAnother?: () => void;
}

export const SyncScoreResultsModal: React.FC<SyncScoreResultsModalProps> = ({
  isOpen,
  onClose,
  score,
  personAName,
  personBName,
  onCalculateAnother,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  if (!isOpen) return null;

  // Format the date as "Today" or "Oct 26"
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) return 'Today';
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get score color based on value
  const getScoreColor = (scoreValue: number): string => {
    if (scoreValue >= 80) return 'text-purple-600';
    if (scoreValue >= 60) return 'text-blue-600';
    if (scoreValue >= 40) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const scoreColor = getScoreColor(score.overall);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>

          <h2 className="text-3xl font-light text-gray-900 italic mb-2">
            {formatDate(score.calculated_at)}'s Sync Score
          </h2>
          <p className="text-sm text-gray-600 font-light">
            {personAName} & {personBName}
          </p>
        </div>

        {/* Score Display */}
        <div className="px-8 pb-8 space-y-6">
          {/* Large Score Number */}
          <div className="text-center space-y-4">
            <div className={`text-7xl font-light ${scoreColor} mb-2`}>
              {score.overall}%
            </div>
            
            {/* Poetic Headline */}
            <div className="text-2xl font-light text-gray-900 italic">
              {score.poetic_headline}
            </div>

            {/* Cosmic Visual - Glowing Orb */}
            <div className="flex justify-center my-4">
              <div className="relative">
                <div className={`w-16 h-16 rounded-full ${scoreColor.replace('text-', 'bg-')} opacity-20 blur-xl`}></div>
                <Sparkles className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 ${scoreColor}`} />
              </div>
            </div>

            {/* AI Insight */}
            <p className="text-base font-light text-gray-700 italic leading-relaxed px-4">
              "{score.ai_insight}"
            </p>

            {/* Rarity Badge */}
            {score.rarity_percentile >= 50 && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-full">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-light text-purple-900">
                  {score.rarity_percentile >= 95 
                    ? `Top ${100 - score.rarity_percentile}% Connection`
                    : `Rarer than ${score.rarity_percentile}% of connections`
                  }
                </span>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 py-6 border-y border-gray-200">
            <div className="text-center">
              <div className="text-3xl font-light text-green-600">
                {score.breakdown.harmonious_aspects}
              </div>
              <div className="text-sm text-gray-600 font-light mt-1">
                Harmonious Aspects
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-light text-orange-600">
                {score.breakdown.challenging_aspects}
              </div>
              <div className="text-sm text-gray-600 font-light mt-1">
                Challenging Aspects
              </div>
            </div>
          </div>

          {/* Expandable Details */}
          {score.breakdown.key_connections.length > 0 && (
            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between py-3 px-4 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-light text-gray-900">
                  Show Key Connections
                </span>
                {showDetails ? (
                  <ChevronUp className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                )}
              </button>

              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 space-y-2">
                      {score.breakdown.key_connections.map((connection, index) => (
                        <div
                          key={index}
                          className="text-sm text-gray-700 font-light py-2 px-4 bg-gray-50 rounded-lg"
                        >
                          {connection}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Generated Connection Card */}
          {score.card_image_url && (
            <div className="mt-6">
              <p className="text-sm font-light text-gray-600 mb-3 text-center">
                Your Shareable Connection Card
              </p>
              <div className="relative rounded-2xl overflow-hidden shadow-lg">
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <div className="animate-pulse text-gray-400">Loading card...</div>
                  </div>
                )}
                <img
                  src={score.card_image_url}
                  alt="Connection Card"
                  className="w-full h-auto"
                  onLoad={() => setImageLoaded(true)}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            {score.card_image_url ? (
              <Button
                onClick={() => {
                  // Download the image
                  const link = document.createElement('a');
                  link.href = score.card_image_url!;
                  link.download = `sync-score-${personAName}-${personBName}.png`;
                  link.click();
                }}
                className="w-full rounded-full py-6 bg-gray-900 hover:bg-gray-800 text-white font-light flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Download & Share
              </Button>
            ) : (
              <div className="w-full rounded-full py-6 bg-gray-100 text-gray-600 font-light flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 animate-pulse" />
                Generating your card...
              </div>
            )}
            
            {onCalculateAnother && (
              <Button
                onClick={onCalculateAnother}
                variant="outline"
                className="w-full rounded-full py-6 font-light"
              >
                Calculate Another
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

