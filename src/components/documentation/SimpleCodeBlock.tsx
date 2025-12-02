
import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SimpleCodeBlockProps {
  code: string;
  language?: string;
}

const SimpleCodeBlock: React.FC<SimpleCodeBlockProps> = ({
  code,
  language = "javascript"
}) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-4">
      <div className="flex justify-between items-center px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-gray-200 text-sm font-medium">{language}</span>
        <Button
          onClick={copyToClipboard}
          variant="ghost"
          size="sm"
          className="text-gray-300 hover:text-white text-sm flex items-center gap-1"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" /> 
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> 
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <pre className="p-4 text-gray-100 text-sm whitespace-pre-wrap break-words">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

export default SimpleCodeBlock;
