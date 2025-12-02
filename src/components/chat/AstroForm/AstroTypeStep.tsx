import React from 'react';
import { motion } from 'framer-motion';
import { astroRequestCategories } from '@/constants/report-types';

interface AstroTypeStepProps {
  selectedType: string;
  onSelectType: (type: string) => void;
  shouldDisableAnimations: boolean;
}

export const AstroTypeStep: React.FC<AstroTypeStepProps> = ({
  selectedType,
  onSelectType,
  shouldDisableAnimations,
}) => {
  return (
    <motion.div
      key="type"
      initial={shouldDisableAnimations ? undefined : { opacity: 0, x: 20 }}
      animate={shouldDisableAnimations ? undefined : { opacity: 1, x: 0 }}
      exit={shouldDisableAnimations ? undefined : { opacity: 0, x: -20 }}
      transition={shouldDisableAnimations ? { duration: 0 } : undefined}
      className="space-y-4"
    >
      <p className="text-gray-600 text-center mb-6">How would you like to explore today</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {astroRequestCategories.map((category) => {
          const IconComponent = category.icon;
          const isSelected = selectedType === category.value;

          return (
            <motion.button
              key={category.value}
              type="button"
              onClick={() => onSelectType(category.value)}
              className={`w-full p-4 rounded-full border transition-all duration-200 ${
                isSelected
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
              }`}
              whileHover={shouldDisableAnimations ? {} : { scale: 1.02 }}
              whileTap={shouldDisableAnimations ? {} : { scale: 0.98 }}
              transition={shouldDisableAnimations ? { duration: 0 } : undefined}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 flex items-center justify-center rounded-full ${
                    isSelected ? 'bg-white/20' : 'bg-gray-100'
                  }`}
                >
                  <IconComponent className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                </div>
                <div className="text-left">
                  <h3 className={`font-medium ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                    {category.title}
                  </h3>
                  <p className={`text-sm ${isSelected ? 'text-white/80' : 'text-gray-600'}`}>
                    {category.description}
                  </p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};
