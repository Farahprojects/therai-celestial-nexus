
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Palette } from 'lucide-react';

const colors = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef',
  '#f3f3f3', '#ffffff', '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff',
  '#4a86e8', '#0000ff', '#9900ff', '#ff00ff', '#e06666', '#f6b26b', '#ffd966', '#93c47d',
  '#76a5af', '#6fa8dc', '#8e7cc3', '#c27ba0'
];

interface ColorPickerProps {
  onColorSelect: (color: string) => void;
  currentColor?: string;
}

export const ColorPicker = ({ onColorSelect, currentColor }: ColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleColorSelect = (color: string) => {
    onColorSelect(color);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" type="button" className="relative">
          <Palette className="w-4 h-4" />
          {currentColor && (
            <div 
              className="absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white"
              style={{ backgroundColor: currentColor }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium">Text Color</div>
          <div className="grid grid-cols-8 gap-1">
            {colors.map((color) => (
              <Button
                key={color}
                variant="ghost"
                size="sm"
                onClick={() => handleColorSelect(color)}
                className="h-8 w-8 p-0 border hover:scale-110 transition-transform hover:bg-accent"
                style={{ backgroundColor: color }}
              >
                <span className="sr-only">{color}</span>
              </Button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleColorSelect('#000000')}
              className="flex-1"
            >
              Reset
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
