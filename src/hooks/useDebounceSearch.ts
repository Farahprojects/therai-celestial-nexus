
import { useState, useEffect } from 'react';
import { debounce } from '@/lib/utils';

export const useDebounceSearch = (initialValue: string = '', delay: number = 300) => {
  const [searchValue, setSearchValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);

  useEffect(() => {
    const debouncedHandler = debounce((value: string) => {
      setDebouncedValue(value);
    }, delay);

    debouncedHandler(searchValue);

    return () => {
      // Cleanup is handled by the debounce function
    };
  }, [searchValue, delay]);

  return {
    searchValue,
    debouncedValue,
    setSearchValue
  };
};
