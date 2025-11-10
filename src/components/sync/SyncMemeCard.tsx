import React from 'react';
import { MemeData } from '@/services/syncScores';

interface SyncMemeCardProps {
  meme: MemeData;
  imageUrl?: string;
  isLoading?: boolean;
}

export const SyncMemeCard: React.FC<SyncMemeCardProps> = ({ 
  meme, 
  imageUrl, 
  isLoading = false 
}) => {
  const { caption, pattern_category, theme_core, tone } = meme;

  // Pattern emoji mapping
  const patternEmoji: Record<string, string> = {
    wounds: '⚡️',
    harmony: '✨',
    ego_clash: '👑',
    emotional_avoidance: '🧠',
    intensity: '🔥',
    soul_mirror: '🌙'
  };

  // Tone-based background gradients
  const toneGradients: Record<string, string> = {
    funny: 'from-amber-50 via-orange-50 to-rose-50',
    ironic: 'from-slate-50 via-zinc-50 to-stone-50',
    deep: 'from-purple-50 via-indigo-50 to-blue-50',
    smart: 'from-cyan-50 via-teal-50 to-emerald-50',
    chaotic: 'from-red-50 via-pink-50 to-fuchsia-50'
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Image Display */}
      {isLoading ? (
        <div className="aspect-[9/16] rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse flex items-center justify-center">
          <div className="text-center space-y-3 px-8">
            <div className="text-4xl animate-bounce">🎭</div>
            <p className="text-sm font-light text-gray-600 italic">
              Generating your meme...
            </p>
          </div>
        </div>
      ) : imageUrl ? (
        <div className="relative group">
          <img 
            src={imageUrl} 
            alt="Sync Meme" 
            className="w-full aspect-[9/16] object-cover rounded-3xl shadow-2xl"
          />
          {/* Hover overlay with metadata */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-end p-6">
            <div className="text-white space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{patternEmoji[pattern_category]}</span>
                <span className="text-sm font-light italic">{pattern_category.replace('_', ' ')}</span>
              </div>
              <p className="text-xs opacity-80">{theme_core}</p>
            </div>
          </div>
        </div>
      ) : (
        // Fallback text-only meme card
        <div className={`aspect-[9/16] rounded-3xl bg-gradient-to-br ${toneGradients[tone] || toneGradients.deep} p-8 flex flex-col items-center justify-center text-center shadow-2xl`}>
          <div className="space-y-6 max-w-xs">
            {/* Pattern indicator */}
            <div className="text-5xl mb-8">
              {patternEmoji[pattern_category]}
            </div>

            {/* Caption display */}
            {caption.format === 'top_bottom' && (
              <>
                <p className="text-xl font-semibold text-gray-900 leading-tight">
                  {caption.topText}
                </p>
                <div className="h-px bg-gray-300 w-16 mx-auto" />
                <p className="text-xl font-semibold text-gray-900 leading-tight">
                  {caption.bottomText}
                </p>
              </>
            )}

            {caption.format === 'quote' && (
              <div className="space-y-4">
                <p className="text-2xl font-light italic text-gray-900 leading-snug">
                  "{caption.quoteText}"
                </p>
                {caption.attribution && (
                  <p className="text-sm text-gray-600">
                    — {caption.attribution}
                  </p>
                )}
              </div>
            )}

            {caption.format === 'text_only' && (
              <p className="text-xl font-semibold text-gray-900 leading-tight">
                {caption.quoteText}
              </p>
            )}

            {/* Theme subtitle */}
            <div className="pt-8 border-t border-gray-300">
              <p className="text-xs font-light text-gray-600 italic">
                {theme_core}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metadata footer */}
      <div className="mt-4 px-2 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="text-base">{patternEmoji[pattern_category]}</span>
          <span className="capitalize font-light">
            {pattern_category.replace('_', ' ')} • {tone}
          </span>
        </div>
        <span className="font-light italic">
          therai.co
        </span>
      </div>
    </div>
  );
};

