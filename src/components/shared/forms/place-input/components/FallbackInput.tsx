
import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface FallbackInputProps {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  disabled: boolean;
  required: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
}

export const FallbackInput: React.FC<FallbackInputProps> = ({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  isError,
  errorMessage,
  onRetry
}: FallbackInputProps) => {
  return (
    <div className="space-y-2">
      <Input
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 h-12"
        required={required}
        style={{ fontSize: '16px' }}
      />
      {isError && !disabled && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span>Location autocomplete unavailable</span>
          {errorMessage && (
            <span className="text-xs text-red-500">({errorMessage})</span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="h-6 px-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )}
    </div>
  );
};
