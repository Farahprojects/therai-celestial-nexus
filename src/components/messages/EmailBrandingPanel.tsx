
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Upload, Eye, Save } from 'lucide-react';
import { showToast } from '@/utils/notifications';

interface EmailBrandingPanelProps {
  onBack: () => void;
}

export const EmailBrandingPanel = ({ onBack }: EmailBrandingPanelProps) => {
  const [signature, setSignature] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [companyName, setCompanyName] = useState('');

  const handleSaveSignature = () => {
    showToast({
      title: "Signature saved",
      description: "Your email signature has been saved successfully.",
      variant: "success"
    });
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Create a preview URL for the uploaded file
      const url = URL.createObjectURL(file);
      setLogoUrl(url);
      showToast({
        title: "Logo uploaded",
        description: "Your logo has been uploaded successfully.",
        variant: "success"
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 p-6 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Messages
        </Button>
        <h1 className="text-2xl font-semibold">Email Branding</h1>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="signature" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signature">Email Signature</TabsTrigger>
              <TabsTrigger value="logo">Logo & Branding</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="signature" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Email Signature</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signature">Signature Content</Label>
                    <Textarea
                      id="signature"
                      placeholder="Enter your email signature..."
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                      className="min-h-[200px]"
                    />
                  </div>
                  <Button onClick={handleSaveSignature} className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Save Signature
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logo" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Logo & Company Branding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      placeholder="Enter your company name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="logo">Company Logo</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      {logoUrl ? (
                        <div className="space-y-4">
                          <img
                            src={logoUrl}
                            alt="Company logo"
                            className="max-h-32 mx-auto"
                          />
                          <p className="text-sm text-gray-500">Logo uploaded successfully</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Upload className="w-12 h-12 mx-auto text-gray-400" />
                          <p className="text-gray-500">Click to upload your company logo</p>
                        </div>
                      )}
                      <input
                        type="file"
                        id="logo"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>
                  
                  <Button className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Save Branding
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Email Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg p-6 bg-white">
                    <div className="space-y-4">
                      <div className="border-b pb-4">
                        <p className="text-sm text-gray-600">From: you@yourcompany.com</p>
                        <p className="text-sm text-gray-600">To: client@example.com</p>
                        <p className="text-sm text-gray-600">Subject: Sample Email</p>
                      </div>
                      
                      <div className="space-y-4">
                        <p>Dear Client,</p>
                        <p>This is how your emails will appear with your custom branding.</p>
                        
                        {/* Email signature preview */}
                        <div className="border-t pt-4 mt-6">
                          {logoUrl && (
                            <img src={logoUrl} alt="Logo" className="h-8 mb-2" />
                          )}
                          {companyName && (
                            <p className="font-semibold text-gray-800">{companyName}</p>
                          )}
                          {signature && (
                            <div className="mt-2 text-gray-600 whitespace-pre-wrap">
                              {signature}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
