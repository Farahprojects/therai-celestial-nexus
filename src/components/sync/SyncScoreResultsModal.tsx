import React, { useState } from 'react';
import { X, Star, ChevronDown, ChevronUp } from 'lucide-react';
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
  };
  calculated_at: string;
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

  if (!isOpen) return null;

  // Calculate star rating (0-100 score maps to 0-5 stars)
  const starCount = Math.round((score.overall / 100) * 5);
  const stars = Array.from({ length: 5 }, (_, i) => i < starCount);

  // Get score level description
  const getScoreDescription = (score: number): { label: string; color: string } => {
    if (score >= 80) return { label: 'Exceptional Sync', color: 'text-green-600' };
    if (score >= 60) return { label: 'Strong Connection', color: 'text-blue-600' };
    if (score >= 40) return { label: 'Moderate Harmony', color: 'text-yellow-600' };
    if (score >= 20) return { label: 'Growing Potential', color: 'text-orange-600' };
    return { label: 'Challenging Dynamic', color: 'text-red-600' };
  };

  const scoreDesc = getScoreDescription(score.overall);

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
            Sync Score
          </h2>
          <p className="text-sm text-gray-600 font-light">
            {personAName} & {personBName}
          </p>
        </div>

        {/* Score Display */}
        <div className="px-8 pb-8 space-y-6">
          {/* Large Score Number */}
          <div className="text-center">
            <div className={`text-7xl font-light ${scoreDesc.color} mb-2`}>
              {score.overall}%
            </div>
            <div className={`text-lg font-light ${scoreDesc.color} mb-4`}>
              {scoreDesc.label}
            </div>

            {/* Star Rating */}
            <div className="flex justify-center gap-1">
              {stars.map((filled, index) => (
                <Star
                  key={index}
                  className={`w-6 h-6 ${
                    filled ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
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

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            {onCalculateAnother && (
              <Button
                onClick={onCalculateAnother}
                variant="outline"
                className="flex-1 rounded-full py-6 font-light"
              >
                Calculate Another
              </Button>
            )}
            <Button
              onClick={onClose}
              className="flex-1 rounded-full py-6 bg-gray-900 hover:bg-gray-800 text-white font-light"
            >
              Done
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

