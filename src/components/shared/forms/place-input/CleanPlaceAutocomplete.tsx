import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PlaceData } from './utils/extractPlaceData';
import { useIsMobile } from '@/hooks/use-mobile';

export interface CleanPlaceAutocompleteProps {
  label?: string;
  value?: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (placeData: PlaceData) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
  disabled?: boolean;
  error?: string;
}

interface Prediction {
  place_id: string;
  description: string;
}

export const CleanPlaceAutocomplete = ({ 
  label = "Location", 
  value = "", 
  onChange, 
  onPlaceSelect, 
  placeholder = "Enter a location",
  className = "", 
  id = "placeAutocomplete",
  disabled = false,
  error
}: CleanPlaceAutocompleteProps) => {
    const [localValue, setLocalValue] = useState(value);
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<number | undefined>(undefined);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();

    // Sync with external value changes
    useEffect(() => {
      if (value !== localValue) {
        setLocalValue(value);
      }
    }, [value, localValue]);

    // Debounced search function
    const searchPlaces = async (input: string) => {
      if (input.length < 2) {
        setPredictions([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
          body: { query: input }
        });

        if (error) {
          console.error('Places search error:', error);
          setPredictions([]);
          setIsOpen(false);
          return;
        }

        // Handle the response structure correctly
        let newPredictions: Prediction[] = [];
        
        if (Array.isArray(data)) {
          newPredictions = data;
        } else if (data && Array.isArray(data.predictions)) {
          newPredictions = data.predictions;
        } else if (data && typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            newPredictions = Array.isArray(parsed) ? parsed : [];
          } catch (parseError) {
            console.error('Error parsing string response:', parseError);
            newPredictions = [];
          }
        }
        setPredictions(newPredictions);
        setIsOpen(newPredictions.length > 0);
        setHighlightedIndex(-1);
      } catch (error) {
        console.error('Error searching places:', error);
        setPredictions([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
      onChange(newValue);

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Set new debounce
      debounceRef.current = setTimeout(() => {
        searchPlaces(newValue);
      }, 300);
    };

    const handlePlaceSelect = async (prediction: Prediction) => {
      const fullAddress = prediction.description;
      setLocalValue(fullAddress);
      onChange(fullAddress);
      setIsOpen(false);
      setPredictions([]);

      if (onPlaceSelect) {
        try {
          // Get place details to fetch coordinates
          const { data: detailsData, error: detailsError } = await supabase.functions.invoke('google-place-details', {
            body: { placeId: prediction.place_id }
          });

          if (detailsError || !detailsData) {
            console.warn('Could not fetch place details, using basic data:', detailsError);
            // Fallback to basic data without coordinates
            const placeData: PlaceData = {
              name: fullAddress,
              placeId: prediction.place_id
            };
            onPlaceSelect(placeData);
            return;
          }

          // Fix: Use the correct response structure from our edge function
          const placeData: PlaceData = {
            name: detailsData.name || fullAddress,
            placeId: prediction.place_id,
            latitude: detailsData.latitude,
            longitude: detailsData.longitude
          };
          
          onPlaceSelect(placeData);

        } catch (error) {
          console.error('Error processing place selection:', error);
          // Fallback to basic data
          const placeData: PlaceData = {
            name: fullAddress,
            placeId: prediction.place_id
          };
          onPlaceSelect(placeData);
        }
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!isOpen || predictions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev < predictions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0) {
            handlePlaceSelect(predictions[highlightedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          wrapperRef.current && 
          !wrapperRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cleanup debounce on unmount
    useEffect(() => {
      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }, []);

    return (
      <div ref={wrapperRef} className="relative space-y-2">
        {label && (
          <Label htmlFor={id} className="block">
            {label} *
          </Label>
        )}
        
        <div className="relative">
          <div className="relative">
            <Input
              ref={inputRef}
              id={id}
              value={localValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-lpignore="true"
              data-form-type="other"
              className={`pl-10 ${className || "h-12"}`}
            />
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            {isLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Desktop Dropdown */}
          {!isMobile && isOpen && predictions.length > 0 && (
            <div
              className="absolute z-[10000] w-full mt-1 bg-white border border-border rounded-md shadow-lg max-h-60 overflow-auto"
              style={{ backgroundColor: 'hsl(var(--background))' }}
            >
              {predictions.map((prediction, index) => (
                <div
                  key={prediction.place_id}
                  className={`px-3 py-3 cursor-pointer hover:bg-muted transition-colors ${
                    index === highlightedIndex ? 'bg-muted' : ''
                  }`}
                  onClick={() => handlePlaceSelect(prediction)}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                       <div className="font-medium text-sm truncate">
                         {prediction.description}
                       </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mobile Full-Page Overlay */}
        {isMobile && isOpen && (
          <div className="fixed inset-0 z-[50] bg-white">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center p-4 border-b bg-white">
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 -ml-2 mr-3"
                >
                  <ArrowLeft className="h-6 w-6" />
                </button>
                <h2 className="text-lg font-light flex-1">Select Location</h2>
              </div>
              
              {/* Search Input */}
              <div className="p-4 border-b bg-white">
                <div className="relative">
                  <Input
                    value={localValue}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    data-lpignore="true"
                    data-form-type="other"
                    className="h-12 rounded-full pl-10 text-base"
                    style={{ fontSize: '16px' }}
                  />
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  {isLoading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Results */}
              <div className="flex-1 overflow-auto">
                {predictions.length > 0 ? (
                  predictions.map((prediction) => (
                    <div
                      key={prediction.place_id}
                      className="px-4 py-4 border-b border-border cursor-pointer hover:bg-muted transition-colors active:bg-muted"
                      onClick={() => {
                        handlePlaceSelect(prediction);
                        setIsOpen(false);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                           <div className="font-medium text-base leading-tight">
                             {prediction.description}
                           </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : localValue.trim() && !isLoading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No locations found
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
        
        {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
      </div>
    );
};
