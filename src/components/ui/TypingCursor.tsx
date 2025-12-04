
interface TypingCursorProps {
  visible: boolean;
  className?: string;
}

export const TypingCursor = ({ visible, className = "" }: TypingCursorProps) => {
  return (
    <span 
      className={`inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 ${visible ? 'opacity-100' : 'opacity-0'} transition-opacity duration-100 ${className}`}
    />
  );
};
