
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Link } from 'lucide-react';

interface LinkInsertPopupProps {
  onLinkInsert: (url: string, text: string) => void;
}

export const LinkInsertPopup = ({ onLinkInsert }: LinkInsertPopupProps) => {
  const [url, setUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleInsertLink = () => {
    if (url) {
      onLinkInsert(url, linkText || url);
      setUrl('');
      setLinkText('');
      setIsOpen(false);
    }
  };

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" type="button">
          <Link className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-8"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="linkText">Link Text (optional)</Label>
            <Input
              id="linkText"
              placeholder="Click here"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              className="h-8"
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleInsertLink}
              disabled={!url || !isValidUrl(url)}
            >
              Insert Link
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
