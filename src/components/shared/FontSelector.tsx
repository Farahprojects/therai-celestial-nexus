
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Type } from 'lucide-react';
import { FONT_REGISTRY, getFontsByCategory, getFontByValue } from '@/utils/fontRegistry';

interface FontSelectorProps {
  onFontSelect: (fontClass: string) => void;
  currentFont?: string;
  showCategories?: boolean;
  triggerVariant?: 'default' | 'ghost' | 'outline';
  triggerSize?: 'default' | 'sm' | 'lg';
}

export const FontSelector = ({ 
  onFontSelect, 
  currentFont = 'font-inter',
  showCategories = false,
  triggerVariant = 'ghost',
  triggerSize = 'sm'
}: FontSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentFontData = getFontByValue(currentFont);
  
  const renderFontButton = (font: typeof FONT_REGISTRY[0]) => (
    <Button
      key={font.value}
      variant={currentFont === font.value ? "default" : "ghost"}
      size="sm"
      onClick={() => {
        onFontSelect(font.value);
        setIsOpen(false);
      }}
      className={`w-full justify-start ${font.class} text-left`}
    >
      <div className="flex flex-col items-start">
        <span className="font-medium">{font.name}</span>
        <span className="text-xs text-muted-foreground capitalize">
          {font.category}
        </span>
      </div>
    </Button>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} type="button">
          <Type className="w-4 h-4 mr-2" />
          {currentFontData?.name || 'Select Font'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4">
          {showCategories ? (
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="sans-serif" className="text-xs">Sans</TabsTrigger>
                <TabsTrigger value="serif" className="text-xs">Serif</TabsTrigger>
                <TabsTrigger value="display" className="text-xs">Display</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all">
                <ScrollArea className="h-64">
                  <div className="space-y-1 pr-3">
                    {FONT_REGISTRY.map(renderFontButton)}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="sans-serif">
                <ScrollArea className="h-64">
                  <div className="space-y-1 pr-3">
                    {getFontsByCategory('sans-serif').map(renderFontButton)}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="serif">
                <ScrollArea className="h-64">
                  <div className="space-y-1 pr-3">
                    {getFontsByCategory('serif').map(renderFontButton)}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="display">
                <ScrollArea className="h-64">
                  <div className="space-y-1 pr-3">
                    {getFontsByCategory('display').map(renderFontButton)}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-medium mb-3">Font Family</div>
              <ScrollArea className="h-64">
                <div className="space-y-1 pr-3">
                  {FONT_REGISTRY.map(renderFontButton)}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
