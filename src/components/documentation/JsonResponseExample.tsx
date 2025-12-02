
import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JsonResponseExampleProps {
  title: string;
  description?: string;
  jsonCode: string;
}

const JsonResponseExample: React.FC<JsonResponseExampleProps> = ({
  title,
  description,
  jsonCode,
}) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">{title}</h2>
      {description && <p className="mb-4">{description}</p>}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden">
        <div className="flex justify-between items-center px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-gray-200 text-sm font-medium">JSON</span>
          <Button 
            onClick={() => copyToClipboard(jsonCode)} 
            className="text-gray-300 hover:text-white text-sm flex items-center gap-1"
            variant="ghost"
            size="sm"
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
            <code>{jsonCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default JsonResponseExample;
