
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import PickerWheel from './PickerWheel';
interface InlineDateWheelProps {
  value: string; // YYYY-MM-DD format
  onChange: (date: string) => void;
}

const InlineDateWheel = ({ value, onChange }: InlineDateWheelProps) => {
  const months = useMemo(() => [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ], []);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 111 }, (_, i) => currentYear - 100 + i);
  }, []);

  const parseDate = useCallback((dateValue: string) => {
    if (!dateValue || typeof dateValue !== 'string') {
      const now = new Date();
      return {
        month: now.getMonth() + 1,
        day: now.getDate(),
        year: now.getFullYear()
      };
    }
    
    // Parse YYYY-MM-DD format explicitly (never use new Date() for parsing)
    const isoMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return {
        year: parseInt(isoMatch[1], 10),
        month: parseInt(isoMatch[2], 10),
        day: parseInt(isoMatch[3], 10)
      };
    }
    
    // Fallback to current date if format is invalid
    console.warn('[InlineDateWheel] Invalid date format received:', dateValue, 'Expected YYYY-MM-DD');
    const now = new Date();
    return {
      month: now.getMonth() + 1,
      day: now.getDate(),
      year: now.getFullYear()
    };
  }, []);

  const initialDate = useMemo(() => parseDate(value), [parseDate, value]);
  
  const [selectedMonth, setSelectedMonth] = useState<number>(initialDate.month);
  const [selectedDay, setSelectedDay] = useState<number>(initialDate.day);
  const [selectedYear, setSelectedYear] = useState<number>(initialDate.year);

  // Debounce timer ref
  const debounceTimer = useRef<number | undefined>(undefined);

  const getDaysInMonth = useCallback((month: number, year: number) => {
    return new Date(year, month, 0).getDate();
  }, []);

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const days = useMemo(() => 
    Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  );

  // Debounced onChange to prevent rapid updates during scrolling
  const debouncedOnChange = useCallback((month: number, day: number, year: number) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    debounceTimer.current = setTimeout(() => {
      const maxDays = getDaysInMonth(month, year);
      const adjustedDay = Math.min(day, maxDays);
      
      const dateString = `${year}-${month.toString().padStart(2, '0')}-${adjustedDay.toString().padStart(2, '0')}`;
      onChange(dateString);
    }, 100); // 100ms debounce
  }, [onChange, getDaysInMonth]);

  useEffect(() => {
    const maxDays = getDaysInMonth(selectedMonth, selectedYear);
    const adjustedDay = Math.min(selectedDay, maxDays);
    
    if (adjustedDay !== selectedDay) {
      setSelectedDay(adjustedDay);
      return;
    }

    debouncedOnChange(selectedMonth, adjustedDay, selectedYear);
  }, [selectedMonth, selectedDay, selectedYear, debouncedOnChange, getDaysInMonth]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleMonthChange = useCallback((newValue: string) => {
    const monthIndex = months.indexOf(newValue) + 1;
    // Only update if different to prevent unnecessary re-renders
    if (monthIndex !== selectedMonth) {
      setSelectedMonth(monthIndex);
    }
  }, [months, selectedMonth]);

  const handleDayChange = useCallback((newValue: number) => {
    // Only update if different to prevent unnecessary re-renders
    if (newValue !== selectedDay) {
      setSelectedDay(newValue);
    }
  }, [selectedDay]);

  const handleYearChange = useCallback((newValue: number) => {
    // Only update if different to prevent unnecessary re-renders  
    if (newValue !== selectedYear) {
      setSelectedYear(newValue);
    }
  }, [selectedYear]);

  return (
    <div className="flex items-center justify-center gap-8 px-4 py-2">
      <div className="flex-1 min-w-[100px]">
        <div className="text-sm font-medium text-gray-600 text-center mb-3">Month</div>
        <PickerWheel
          options={months}
          value={months[selectedMonth - 1] ?? months[0]}
          onChange={handleMonthChange}
          height={200}
          itemHeight={40}
          infinite={true}
        />
      </div>

      <div className="flex-1 min-w-[80px]">
        <div className="text-sm font-medium text-gray-600 text-center mb-3">Day</div>
        <PickerWheel
          options={days}
          value={selectedDay}
          onChange={handleDayChange}
          height={200}
          itemHeight={40}
          infinite={true}
        />
      </div>

      <div className="flex-1 min-w-[100px]">
        <div className="text-sm font-medium text-gray-600 text-center mb-3">Year</div>
        <PickerWheel
          options={years}
          value={selectedYear}
          onChange={handleYearChange}
          height={200}
          itemHeight={40}
          infinite={true}
        />
      </div>
    </div>
  );
};

export default InlineDateWheel;
