
interface ProcessingIndicatorProps {
  message: string;
  className?: string;
}

export const ProcessingIndicator = ({ 
  message, 
  className = "" 
}: ProcessingIndicatorProps) => {
  return (
    <div className={`flex items-center gap-2 text-sm text-gray-600 ${className}`}>
      <span>{message}</span>
      <div className="flex gap-1">
        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" 
             style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" 
             style={{ animationDelay: '200ms' }} />
        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" 
             style={{ animationDelay: '400ms' }} />
      </div>
    </div>
  );
};
