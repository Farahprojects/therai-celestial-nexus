import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

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

        {/* Content */}
        <div className="px-8 pb-8 space-y-6 text-center">
          {/* Success Message */}
          <div className="space-y-4 py-8">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-purple-600" />
                </div>
              </div>
            </div>
            
            <h3 className="text-2xl font-light text-gray-900">
              Sync Score Calculated!
            </h3>
            
            <p className="text-base font-light text-gray-600 leading-relaxed max-w-md mx-auto">
              Your personalized connection card is being generated and will appear in your chat in just a moment.
            </p>

            {/* Score Preview */}
            <div className={`text-6xl font-light ${scoreColor} my-6`}>
              {score.overall}%
            </div>
            <div className="text-xl font-light text-gray-900 italic">
              {score.poetic_headline}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            <Button
              onClick={onClose}
              className="w-full rounded-full py-6 bg-gray-900 hover:bg-gray-800 text-white font-light"
            >
              View in Chat
            </Button>
            
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

