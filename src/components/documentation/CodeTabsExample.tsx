
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CodeTabsExampleProps {
  title: string;
  description?: string;
  curlCode: string;
  pythonCode: string;
  javaCode: string;
}

const CodeTabsExample: React.FC<CodeTabsExampleProps> = ({
  title,
  description,
  curlCode,
  pythonCode,
  javaCode,
}) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, language: string) => {
    navigator.clipboard.writeText(text);
    setCopied(language);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="rounded-lg overflow-hidden">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
      {description && <p className="mb-4 text-gray-600">{description}</p>}
      
      <Tabs defaultValue="curl" className="w-full overflow-hidden">
        <TabsList className="border-b bg-gray-50">
          <TabsTrigger value="curl">cURL</TabsTrigger>
          <TabsTrigger value="python">Python</TabsTrigger>
          <TabsTrigger value="java">Java</TabsTrigger>
        </TabsList>
        
        {["curl", "python", "java"].map((lang) => (
          <TabsContent key={lang} value={lang} className="bg-gray-900 rounded-b-lg overflow-hidden">
            <div className="flex justify-between items-center px-4 py-2 bg-gray-800 border-b border-gray-700">
              <span className="text-gray-200 text-sm font-medium">{lang.toUpperCase()}</span>
              <Button
                onClick={() => copyToClipboard(
                  lang === "curl" ? curlCode : lang === "python" ? pythonCode : javaCode,
                  lang
                )}
                variant="ghost"
                size="sm"
                className="text-gray-300 hover:text-white text-sm flex items-center gap-1"
              >
                {copied === lang ? (
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
              <pre className="p-4 text-gray-100 text-sm">
                <code>{lang === "curl" ? curlCode : lang === "python" ? pythonCode : javaCode}</code>
              </pre>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default CodeTabsExample;
