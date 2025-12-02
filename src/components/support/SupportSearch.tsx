import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SupportSearchProps {
  onSearchChange: (value: string) => void;
}

export const SupportSearch: React.FC<SupportSearchProps> = ({ onSearchChange }) => {
  const [searchValue, setSearchValue] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    onSearchChange(value);
  };

  const handleClear = () => {
    setSearchValue('');
    onSearchChange('');
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
      <Input
        type="text"
        placeholder="Search support articles..."
        value={searchValue}
        onChange={handleChange}
        className="pl-12 pr-12 h-14 rounded-xl border-gray-200 bg-gray-50/50 font-light text-base placeholder:text-gray-400 focus:border-gray-900 focus:bg-white transition-all duration-300"
      />
      {searchValue && (
        <button
          onClick={handleClear}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Clear search"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

