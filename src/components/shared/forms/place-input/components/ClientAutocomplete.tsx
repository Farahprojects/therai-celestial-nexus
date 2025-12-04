import React from 'react';
import { Input } from '@/components/ui/input';
import { PlaceData } from '../utils/extractPlaceData';

interface ClientAutocompleteProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (placeData: PlaceData) => void;
  placeholder: string;
  disabled: boolean;
  className?: string;
  autoComplete?: string;
  autoCorrect?: string;
  autoCapitalize?: string;
  spellCheck?: boolean;
  'data-lpignore'?: string;
  'data-form-type'?: string;
}

export const ClientAutocomplete: React.FC<ClientAutocompleteProps> = ({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  className = '',
  autoComplete = "off",
  autoCorrect = "off",
  autoCapitalize = "off",
  spellCheck = false,
  'data-lpignore': dataLpIgnore = "true",
  'data-form-type': dataFormType = "other"
}: ClientAutocompleteProps) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <Input
      id={id}
      value={value}
      onChange={handleInputChange}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete={autoComplete}
      autoCorrect={autoCorrect}
      autoCapitalize={autoCapitalize}
      spellCheck={spellCheck}
      data-lpignore={dataLpIgnore}
      data-form-type={dataFormType}
      className={`h-14 rounded-xl text-lg font-light border-gray-200 focus:border-gray-400 ${className}`}
      style={{ fontSize: '16px' }} // Prevent zoom on iOS
    />
  );
};