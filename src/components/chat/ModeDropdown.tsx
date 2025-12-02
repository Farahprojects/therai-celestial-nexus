import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useMode } from '@/contexts/ModeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const ModeDropdown: React.FC = () => {
  const { mode, setMode, isModeLocked } = useMode();

  const modes = [
    { value: 'chat' as const, label: 'Chat' },
    { value: 'astro' as const, label: 'Astro' },
    { value: 'insight' as const, label: 'Insight' },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          className={`flex items-center gap-1 text-sm font-light transition-colors ${
            isModeLocked 
              ? 'text-gray-500 cursor-default' 
              : 'text-gray-700 hover:text-gray-900 cursor-pointer'
          }`}
          disabled={isModeLocked}
        >
          <span>Mode:</span>
          <span className="font-medium">{modes.find(m => m.value === mode)?.label}</span>
          {!isModeLocked && <ChevronDown className="h-3 w-3" />}
        </button>
      </DropdownMenuTrigger>
      
      {!isModeLocked && (
        <DropdownMenuContent align="start" className="w-32">
          {modes.map((modeOption) => (
            <DropdownMenuItem
              key={modeOption.value}
              onClick={() => setMode(modeOption.value)}
              className={`cursor-pointer ${
                mode === modeOption.value ? 'bg-gray-100' : ''
              }`}
            >
              {modeOption.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
};
