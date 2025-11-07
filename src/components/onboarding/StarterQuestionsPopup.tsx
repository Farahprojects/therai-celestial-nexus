import React from 'react';
import { motion } from 'framer-motion';

interface StarterQuestionsPopupProps {
  isOpen: boolean;
  onQuestionSelect: (question: string) => void;
}

const STARTER_QUESTIONS = [
  "Tell me how I'm wired",
  "What are my strengths?",
  "How do I communicate best?",
  "What should I focus on this month?",
  "What are my relationship patterns?"
];

export const StarterQuestionsPopup: React.FC<StarterQuestionsPopupProps> = ({
  isOpen,
  onQuestionSelect,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl"
      >
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-light text-gray-900">Start a conversation</h2>
            <p className="text-sm font-light text-gray-600 mt-2">Choose a question to begin</p>
          </div>

          {/* Questions List */}
          <div className="space-y-3">
            {STARTER_QUESTIONS.map((question, index) => (
              <button
                key={index}
                onClick={() => onQuestionSelect(question)}
                className="w-full text-left px-6 py-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-base font-light text-gray-900"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

