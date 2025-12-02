
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Smile } from 'lucide-react';

const emojiCategories = {
  smileys: { 
    label: '😀 Smileys', 
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑']
  },
  people: { 
    label: '👶 People', 
    emojis: ['👶', '🧒', '👦', '👧', '🧑', '👨', '👩', '🧓', '👴', '👵', '👮', '🕵️', '💂', '👷', '🤴', '👸', '👳', '👲', '🧕', '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶']
  },
  nature: { 
    label: '🐶 Nature', 
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥']
  },
  food: { 
    label: '🍏 Food', 
    emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🍍', '🥭', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥒', '🥬', '🌶️', '🌽', '🥕', '🥔']
  },
  travel: { 
    label: '🚗 Travel', 
    emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🏍️', '🚲', '🛴', '🚁', '🚟', '🚠', '🚡', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '✈️']
  },
  objects: { 
    label: '⌚ Objects', 
    emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠']
  }
};

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export const EmojiPicker = ({ onEmojiSelect }: EmojiPickerProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');

  const filteredEmojis = searchTerm
    ? Object.values(emojiCategories).flatMap(cat => cat.emojis).filter(emoji => 
        emoji.includes(searchTerm)
      )
    : emojiCategories[activeCategory as keyof typeof emojiCategories].emojis;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" type="button" className="p-2">
          <Smile className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <Input
            placeholder="Search emojis..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8"
          />
        </div>
        
        {!searchTerm && (
          <ScrollArea className="h-12">
            <div className="flex p-2 gap-1">
              {Object.entries(emojiCategories).map(([key, category]) => (
                <Button
                  key={key}
                  variant={activeCategory === key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveCategory(key)}
                  className="text-lg whitespace-nowrap px-2 h-8"
                  title={category.label}
                >
                  {category.label.split(' ')[0]}
                </Button>
              ))}
            </div>
          </ScrollArea>
        )}
        
        <ScrollArea className="h-48">
          <div className="p-3 grid grid-cols-6 gap-2">
            {filteredEmojis.map((emoji, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => onEmojiSelect(emoji)}
                className="h-10 w-10 p-0 text-2xl hover:bg-accent rounded-md"
              >
                {emoji}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
