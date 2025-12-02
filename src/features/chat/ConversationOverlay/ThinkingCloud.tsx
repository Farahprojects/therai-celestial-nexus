import React from 'react';
import { motion } from 'framer-motion';

export const ThinkingCloud: React.FC = () => {
  return (
    <div className="relative">
      {/* Main thought bubble */}
      <motion.div
        className="relative bg-black rounded-full w-24 h-24 md:w-32 md:h-32 shadow-lg flex items-center justify-center"
        animate={{
          scale: [1, 1.05, 1],
          y: [0, -2, 0],
        }}
        transition={{
          repeat: Infinity,
          duration: 2,
          ease: "easeInOut"
        }}
      >
        {/* Three dots */}
        <div className="flex items-center justify-center gap-2">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              className="w-2 h-2 bg-white rounded-full"
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                repeat: Infinity,
                duration: 1.5,
                delay: index * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* Connecting bubbles */}
      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
        <motion.div
          className="w-3 h-3 bg-black rounded-full mb-1"
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{
            repeat: Infinity,
            duration: 2,
            delay: 0.5,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="w-2 h-2 bg-black rounded-full"
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            repeat: Infinity,
            duration: 2,
            delay: 1,
            ease: "easeInOut"
          }}
        />
      </div>
    </div>
  );
};
