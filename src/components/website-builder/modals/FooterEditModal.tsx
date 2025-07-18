import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

interface FooterEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  customizationData: any;
  onChange: (field: string, value: any) => void;
  templateName?: string;
}

const colorOptions = [
  { name: 'Modern Blue', value: '#6366F1', category: 'modern' },
  { name: 'Royal Purple', value: '#8B5CF6', category: 'elegant' },
  { name: 'Emerald Green', value: '#10B981', category: 'natural' },
  { name: 'Sunset Orange', value: '#F59E0B', category: 'warm' },
  { name: 'Crimson Red', value: '#EF4444', category: 'bold' },
  { name: 'Ocean Blue', value: '#3B82F6', category: 'professional' },
  { name: 'Forest Green', value: '#059669', category: 'natural' },
  { name: 'Deep Purple', value: '#7C3AED', category: 'creative' },
  { name: 'Coral Pink', value: '#EC4899', category: 'vibrant' },
  { name: 'Navy Blue', value: '#1E40AF', category: 'corporate' }
];

const fontOptions = [
  { name: 'Inter', value: 'Inter', category: 'Modern Sans-serif', preview: 'Clean and readable' },
  { name: 'Poppins', value: 'Poppins', category: 'Geometric Sans-serif', preview: 'Friendly and approachable' },
  { name: 'Montserrat', value: 'Montserrat', category: 'Urban Sans-serif', preview: 'Professional and elegant' },
  { name: 'Playfair Display', value: 'Playfair Display', category: 'Serif', preview: 'Traditional and sophisticated' },
  { name: 'Source Sans Pro', value: 'Source Sans Pro', category: 'Humanist Sans-serif', preview: 'Clear and versatile' },
  { name: 'Lato', value: 'Lato', category: 'Humanist Sans-serif', preview: 'Warm and friendly' },
  { name: 'Open Sans', value: 'Open Sans', category: 'Humanist Sans-serif', preview: 'Neutral and legible' },
  { name: 'Merriweather', value: 'Merriweather', category: 'Serif', preview: 'Classical and readable' }
];

export const FooterEditModal: React.FC<FooterEditModalProps> = ({
  isOpen,
  onClose,
  customizationData,
  onChange,
  templateName
}) => {
  const colorSectionLabel = templateName === 'Creative' ? 'Button Text Color' : 'Brand Color';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
        
        <DialogHeader>
          <DialogTitle>Edit Footer & Theme</DialogTitle>
        </DialogHeader>
        
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div>
              <Label htmlFor="footerHeading" className="text-sm font-medium text-gray-700">Footer Heading</Label>
              <Input
                id="footerHeading"
                value={customizationData.footerHeading || ''}
                onChange={(e) => onChange('footerHeading', e.target.value)}
                placeholder="e.g., Ready to Transform Your Life?"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="footerSubheading" className="text-sm font-medium text-gray-700">Footer Subheading</Label>
              <Input
                id="footerSubheading"
                value={customizationData.footerSubheading || ''}
                onChange={(e) => onChange('footerSubheading', e.target.value)}
                placeholder="e.g., Take the first step towards achieving your goals."
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">{colorSectionLabel}</Label>
              <div className="grid grid-cols-10 gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => onChange('themeColor', color.value)}
                    className={`group relative w-8 h-8 rounded-full border-2 transition-all ${
                      customizationData.themeColor === color.value 
                        ? 'border-gray-800 scale-110' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  >
                    {customizationData.themeColor === color.value && (
                      <div className="absolute inset-0 flex items-center justify-center text-white">
                        <div className="text-xs">✓</div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <Label htmlFor="fontFamily" className="text-sm font-medium text-gray-700">Text Font</Label>
              <div className="w-1/2">
                <Select
                  value={customizationData.fontFamily || 'Inter'}
                  onValueChange={(value) => onChange('fontFamily', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {fontOptions.map((font) => (
                      <SelectItem key={font.value} value={font.value}>
                        <div className="flex flex-col">
                          <span style={{ fontFamily: font.value }} className="font-medium">
                            {font.name}
                          </span>
                          <span className="text-xs text-gray-500">{font.category} • {font.preview}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};
