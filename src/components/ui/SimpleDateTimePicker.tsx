import React, { useState, useRef } from 'react';
import { CalendarIcon, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { SimpleDatePicker } from './SimpleDatePicker';
import { SimpleTimePicker } from './SimpleTimePicker';
import { cn } from '@/lib/utils';

interface SimpleDateTimePickerProps {
  dateValue?: string;
  timeValue?: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  hasDateError?: boolean;
  hasTimeError?: boolean;
}

export const SimpleDateTimePicker: React.FC<SimpleDateTimePickerProps> = ({
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  hasDateError = false,
  hasTimeError = false
}) => {
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isTimeOpen, setIsTimeOpen] = useState(false);

  // Parse values for display
  const [day, month, year] = dateValue ? dateValue.split('-').reverse() : ['', '', ''];
  const [hour, minute] = timeValue ? timeValue.split(':') : ['', ''];
  const displayHour = hour ? (parseInt(hour) > 12 ? (parseInt(hour) - 12).toString() : (parseInt(hour) === 0 ? '12' : hour)) : '';
  const displayMinute = minute || '';
  const ampm = timeValue && timeValue.includes(':') 
    ? (parseInt(timeValue.split(':')[0]) >= 12 ? 'PM' : 'AM')
    : 'AM';

  // Refs for manual input
  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);

  // Handle manual date input
  const handleDateInput = (value: string, field: 'day' | 'month' | 'year', nextRef?: React.RefObject<HTMLInputElement>) => {
    const numValue = value.replace(/\D/g, '');
    
    if (field === 'day') {
      const validDay = Math.min(parseInt(numValue) || 0, 31).toString();
      if (numValue.length === 2 && parseInt(numValue) > 0 && parseInt(numValue) <= 31) {
        const currentMonth = monthRef.current?.value || month;
        const currentYear = yearRef.current?.value || year;
        updateDate(validDay, currentMonth, currentYear);
        nextRef?.current?.focus();
      } else if (numValue.length <= 2) {
        const currentMonth = monthRef.current?.value || month;
        const currentYear = yearRef.current?.value || year;
        updateDate(validDay, currentMonth, currentYear);
      }
      return validDay;
    } else if (field === 'month') {
      const validMonth = Math.min(parseInt(numValue) || 0, 12).toString();
      if (numValue.length === 2 && parseInt(numValue) > 0 && parseInt(numValue) <= 12) {
        const currentDay = dayRef.current?.value || day;
        const currentYear = yearRef.current?.value || year;
        updateDate(currentDay, validMonth, currentYear);
        nextRef?.current?.focus();
      } else if (numValue.length <= 2) {
        const currentDay = dayRef.current?.value || day;
        const currentYear = yearRef.current?.value || year;
        updateDate(currentDay, validMonth, currentYear);
      }
      return validMonth;
    } else if (field === 'year') {
      if (numValue.length === 4) {
        const currentDay = dayRef.current?.value || day;
        const currentMonth = monthRef.current?.value || month;
        updateDate(currentDay, currentMonth, numValue);
      }
      return numValue;
    }
    return value;
  };

  // Handle manual time input
  const handleTimeInput = (value: string, field: 'hour' | 'minute', nextRef?: React.RefObject<HTMLInputElement>) => {
    const numValue = value.replace(/\D/g, '');
    
    if (field === 'hour') {
      const validHour = Math.min(parseInt(numValue) || 1, 12).toString();
      if (numValue.length === 2 && parseInt(numValue) > 0 && parseInt(numValue) <= 12) {
        const currentMinute = minuteRef.current?.value || minute;
        updateTime(validHour, currentMinute, ampm);
        nextRef?.current?.focus();
      } else if (numValue.length <= 2) {
        const currentMinute = minuteRef.current?.value || minute;
        updateTime(validHour, currentMinute, ampm);
      }
      return validHour;
    } else if (field === 'minute') {
      const validMinute = Math.min(parseInt(numValue) || 0, 59).toString().padStart(2, '0');
      if (numValue.length === 2) {
        const currentHour = hourRef.current?.value || hour;
        updateTime(currentHour, validMinute, ampm);
      } else if (numValue.length <= 2) {
        const currentHour = hourRef.current?.value || hour;
        updateTime(currentHour, validMinute, ampm);
      }
      return validMinute;
    }
    return value;
  };

  // Update date from manual input
  const updateDate = (newDay: string, newMonth: string, newYear: string) => {
    if (newDay && newMonth && newYear && newDay.length >= 1 && newMonth.length >= 1 && newYear.length >= 4) {
      const dateStr = `${newYear}-${newMonth.padStart(2, '0')}-${newDay.padStart(2, '0')}`;
      onDateChange(dateStr);
    }
  };

  // Update time from manual input
  const updateTime = (newHour: string, newMinute: string, newAmpm: string) => {
    if (newHour && newMinute && newHour.length >= 1 && newMinute.length >= 1) {
      let hour24 = parseInt(newHour);
      if (newAmpm === 'PM' && hour24 !== 12) hour24 += 12;
      if (newAmpm === 'AM' && hour24 === 12) hour24 = 0;
      
      const timeString = `${hour24.toString().padStart(2, '0')}:${newMinute.padStart(2, '0')}`;
      onTimeChange(timeString);
    }
  };

  const containerClass = (hasError: boolean) => cn(
    "inline-flex items-center bg-white border-2 rounded-full transition-all duration-200 px-3 py-1",
    hasError ? "border-red-300" : "border-gray-200 focus-within:border-gray-400"
  );

  const inputClass = "w-full h-8 text-center border-0 bg-transparent focus:outline-none focus:ring-0 text-sm font-light";

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Date Picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Date * <span className="text-xs text-gray-500 font-normal">(DD/MM/YYYY)</span>
        </label>
        <div className="flex items-center gap-2">
          <div className={containerClass(hasDateError)}>
            <input
              ref={dayRef}
              type="text"
              defaultValue={day}
              onChange={(e) => {
                const newValue = handleDateInput(e.target.value, 'day', monthRef);
                updateDate(newValue, month, year);
              }}
              className={cn(inputClass, "w-8")}
              placeholder="DD"
              maxLength={2}
            />
            <span className="text-gray-400 text-sm">/</span>
            <input
              ref={monthRef}
              type="text"
              defaultValue={month}
              onChange={(e) => {
                const newValue = handleDateInput(e.target.value, 'month', yearRef);
                updateDate(day, newValue, year);
              }}
              className={cn(inputClass, "w-8")}
              placeholder="MM"
              maxLength={2}
            />
            <span className="text-gray-400 text-sm">/</span>
            <input
              ref={yearRef}
              type="text"
              defaultValue={year}
              onChange={(e) => {
                const newValue = handleDateInput(e.target.value, 'year');
                updateDate(day, month, newValue);
              }}
              className={cn(inputClass, "w-12")}
              placeholder="YYYY"
              maxLength={4}
            />
          </div>
          
          <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
              >
                <CalendarIcon className="h-4 w-4 text-gray-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <SimpleDatePicker
                value={dateValue}
                onChange={onDateChange}
                onClose={() => setIsDateOpen(false)}
                hasError={hasDateError}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Time Picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Time *</label>
        <div className="flex items-center gap-2">
          <Popover open={isTimeOpen} onOpenChange={setIsTimeOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
              >
                <Clock className="h-4 w-4 text-gray-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <SimpleTimePicker
                value={timeValue}
                onChange={onTimeChange}
                onClose={() => setIsTimeOpen(false)}
                hasError={hasTimeError}
              />
            </PopoverContent>
          </Popover>
          
          <div className={containerClass(hasTimeError)}>
            <input
              ref={hourRef}
              type="text"
              defaultValue={displayHour}
              onChange={(e) => {
                const newValue = handleTimeInput(e.target.value, 'hour', minuteRef);
                updateTime(newValue, minute, ampm);
              }}
              className={cn(inputClass, "w-8")}
              placeholder="HH"
              maxLength={2}
            />
            <span className="text-gray-400 text-sm">:</span>
            <input
              ref={minuteRef}
              type="text"
              defaultValue={displayMinute}
              onChange={(e) => {
                const newValue = handleTimeInput(e.target.value, 'minute');
                updateTime(hour, newValue, ampm);
              }}
              className={cn(inputClass, "w-8")}
              placeholder="MM"
              maxLength={2}
            />
            <select
              value={ampm}
              onChange={(e) => {
                const currentHour = hourRef.current?.value || hour;
                const currentMinute = minuteRef.current?.value || minute;
                updateTime(currentHour, currentMinute, e.target.value);
              }}
              className="ml-2 bg-transparent border-0 focus:outline-none text-sm font-light text-gray-700 cursor-pointer"
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
