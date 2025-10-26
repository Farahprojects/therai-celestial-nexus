import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useSystemPrompts, SystemPrompt } from '@/hooks/useSystemPrompts';

interface SwissDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewData?: () => void;
  swissData: any | null;
  isLoading: boolean;
  error: string | null;
  chartType?: string;
}

export const SwissDataModal: React.FC<SwissDataModalProps> = ({
  isOpen,
  onClose,
  onViewData,
  swissData,
  isLoading,
  error,
  chartType = 'Swiss Data',
}) => {
  const [copied, setCopied] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<{ name: string; text: string } | null>(null);
  
  const { prompts } = useSystemPrompts();
  
  // Clear selectedPrompt when modal closes or chartType changes
  useEffect(() => {
    if (!isOpen) {
      setSelectedPrompt(null);
      setCopied(false);
      setExpandedCategory(null);
    }
  }, [isOpen]);

  // Clear selectedPrompt when chartType changes
  useEffect(() => {
    setSelectedPrompt(null);
  }, [chartType]);

  // Auto-inject system prompt for weekly and focus chart types
  useEffect(() => {
    if (!swissData || isLoading || error) return;

    const chartTypeNormalized = chartType?.toLowerCase();
    
    // Check if this is a weekly or focus chart type that needs auto-injection
    if (chartTypeNormalized === 'weekly' || chartTypeNormalized === 'focus') {
      // Find the chart_type prompts
      const chartTypePrompts = prompts['chart_type'];
      
      if (!chartTypePrompts || chartTypePrompts.length === 0) {
        console.warn(`[SwissDataModal] chart_type prompts not found. Run the database migration: supabase/migrations/20251025000001_add_chart_type_prompts.sql`);
        return;
      }
      
      const autoPrompt = chartTypePrompts.find(
        (p: SystemPrompt) => p.subcategory.toLowerCase() === chartTypeNormalized
      );
      
      if (autoPrompt && !selectedPrompt) {
        setSelectedPrompt({ 
          name: autoPrompt.subcategory, 
          text: autoPrompt.prompt_text 
        });
      }
    }
  }, [swissData, isLoading, error, chartType, prompts, selectedPrompt]);

  // Auto-expand the single category (e.g., compatibility for sync charts)
  // Must be here at top level before any early returns
  useEffect(() => {
    if (!isOpen || !chartType) return;
    
    const chartTypeNormalized = chartType?.toLowerCase();
    
    const getVisibleCategories = (): string[] => {
      if (!chartTypeNormalized) return [];
      if (chartTypeNormalized === 'essence') {
        return ['mindset', 'health', 'wealth', 'soul', 'career', 'compatibility'];
      }
      if (chartTypeNormalized === 'sync') {
        return ['compatibility'];
      }
      if (chartTypeNormalized === 'weekly' || chartTypeNormalized === 'focus') {
        return [];
      }
      return [];
    };
    
    const categories = getVisibleCategories().filter(cat => prompts[cat] && prompts[cat].length > 0);
    
    if (categories.length === 1 && !expandedCategory) {
      setExpandedCategory(categories[0]);
    }
  }, [isOpen, chartType, prompts, expandedCategory]);

  if (!isOpen) return null;

  // Check if we should show the prompt selector
  const chartTypeNormalized = chartType?.toLowerCase();
  const shouldAutoInject = chartTypeNormalized === 'weekly' || chartTypeNormalized === 'focus';
  const shouldShowPromptSelector = !shouldAutoInject;
  
  

  const handleCopy = async () => {
    try {
      const dataString = JSON.stringify(swissData, null, 2);
      const finalText = selectedPrompt 
        ? `${dataString}\n\n---\n\nSystem Prompt:\n${selectedPrompt.text}`
        : dataString;
      
      await navigator.clipboard.writeText(finalText);
      setCopied(true);
      toast.success('Swiss data copied to clipboard!');
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy data');
    }
  };

  const handleCategoryClick = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category);
  };

  const handleSubcategoryClick = (subcategory: string, promptText: string) => {
    setSelectedPrompt({ name: subcategory, text: promptText });
    setExpandedCategory(null); // Collapse accordion
  };

  // Filter categories based on chart type - deterministic and fail-fast
  const getVisibleCategories = (): string[] => {
    const normalized = chartTypeNormalized;
    
    if (!normalized) {
      // Fail fast - no chart type means no prompts
      return [];
    }
    
    if (normalized === 'essence') {
      // Essence shows all standard categories + compatibility
      return ['mindset', 'health', 'wealth', 'soul', 'career', 'compatibility'];
    }
    
    if (normalized === 'sync') {
      // Sync shows compatibility only
      return ['compatibility'];
    }
    
    // weekly/focus auto-inject, no manual selection needed
    if (normalized === 'weekly' || normalized === 'focus') {
      return [];
    }
    
    // Unknown chart type - fail fast, show no prompts
    return [];
  };

  const categories = getVisibleCategories().filter(cat => prompts[cat] && prompts[cat].length > 0);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-light text-gray-900">
            {isLoading ? 'Generating Swiss Data...' : error ? 'Generation Failed' : 'Swiss Data Ready'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-gray-400 animate-spin mb-4" />
              <p className="text-gray-600 font-light">
                Generating your {chartType} data...
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This usually takes a few seconds
              </p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-gray-900 font-medium mb-2">Generation Failed</p>
              <p className="text-sm text-gray-600 text-center max-w-md">
                {error}
              </p>
            </div>
          )}

          {swissData && !isLoading && !error && (
            <div className="space-y-6">
              <div className="flex items-center justify-center mb-6">
                <Check className="w-5 h-5 text-green-600 mr-2" />
                <p className="text-gray-700 font-medium">
                  Swiss Data Ready
                  {selectedPrompt && shouldAutoInject && (
                    <span className="text-gray-500 font-light ml-2">
                      • {chartType} prompt included
                    </span>
                  )}
                </p>
              </div>

              {/* Starter Conversation Selector - Hidden for weekly/focus (auto-injected) */}
              {shouldShowPromptSelector && (
                <>
                  <div className="space-y-2">
                    <p className="text-base text-gray-600 font-medium mb-3">
                      Add a starter conversation prompt
                    </p>
                    
                    {categories.map((category) => (
                      <div key={category}>
                        {/* Category Button */}
                        <button
                          onClick={() => handleCategoryClick(category)}
                          className="w-full text-left py-3 text-gray-700 font-light text-base hover:text-gray-900 transition-colors flex items-center justify-between"
                        >
                          <span className="capitalize">{category}</span>
                          {expandedCategory === category ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        
                        {/* Subcategories */}
                        {expandedCategory === category && prompts[category] && (
                          <div className="space-y-1 mb-2">
                            {prompts[category].map((prompt: SystemPrompt) => {
                              const isSelected = selectedPrompt?.name === prompt.subcategory;
                              return (
                                <button
                                  key={prompt.id}
                                  onClick={() => handleSubcategoryClick(prompt.subcategory, prompt.prompt_text)}
                                  className={`w-full text-left pl-4 py-2 text-sm rounded-lg transition-colors flex items-center justify-between ${
                                    isSelected 
                                      ? 'bg-green-50 text-green-800 border border-green-200' 
                                      : 'text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <span>{prompt.subcategory}</span>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500 text-center font-light">
                    Your data is saved and can be accessed anytime from your conversation history
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!isLoading && (
          <div className="p-6 border-t border-gray-200">
            <div className="flex gap-3">
              {/* View Button */}
              <Button
                onClick={onViewData || onClose}
                variant="outline"
                className="flex-1 h-14 rounded-full border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 font-light text-base transition-all"
              >
                View Astro Data
              </Button>

              {/* Copy Button */}
              <Button
                onClick={handleCopy}
                className="flex-1 h-14 rounded-full bg-gray-900 hover:bg-gray-800 text-white font-light text-base shadow-lg hover:shadow-xl transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5 mr-2" />
                    Copy Data
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

