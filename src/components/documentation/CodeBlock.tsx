
import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language: "curl" | "javascript" | "python";
  className?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, className }) => {
  const [copySuccess, setCopySuccess] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => {
      setCopySuccess(false);
    }, 2000);
  };

  // Function to highlight the Bearer token in the code
  const highlightBearerToken = (codeText: string) => {
    if (codeText.includes("Bearer YOUR_API_KEY") || codeText.includes("Bearer yourtheriaapikeyhere")) {
      return codeText.split(/('Bearer YOUR_API_KEY'|"Bearer YOUR_API_KEY"|'Bearer yourtheriaapikeyhere'|"Bearer yourtheriaapikeyhere")/).map((part, index) => {
        if (
          part === "'Bearer YOUR_API_KEY'" || 
          part === '"Bearer YOUR_API_KEY"' || 
          part === "'Bearer yourtheriaapikeyhere'" || 
          part === '"Bearer yourtheriaapikeyhere"'
        ) {
          return (
            <span key={index} className="bg-yellow-200 px-1 rounded font-bold">
              {part}
            </span>
          );
        }
        return part;
      });
    }
    return codeText;
  };

  return (
    <div className={cn("relative my-4 rounded-lg overflow-hidden border", className)}>
      <div className="bg-slate-800 py-2 px-4 text-xs text-slate-200 flex justify-between items-center">
        <span className="font-medium">{language.toUpperCase()}</span>
        <button
          onClick={() => copyToClipboard(code)}
          className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors"
        >
          {copySuccess ? (
            <>
              <Check className="h-4 w-4" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="bg-slate-900 text-slate-100 p-4 overflow-x-auto">
        <code className="text-sm">{highlightBearerToken(code)}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;
