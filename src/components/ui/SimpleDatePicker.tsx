import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimpleDatePickerProps {
  value?: string; // YYYY-MM-DD format
  onChange: (date: string) => void;
  onClose: () => void;
  hasError?: boolean;
}

export const SimpleDatePicker: React.FC<SimpleDatePickerProps> = ({
  value,
  onChange,
  onClose
}) => {
  const [currentDate, setCurrentDate] = useState(() => {
    if (value) {
      const date = new Date(value);
      return { year: date.getFullYear(), month: date.getMonth() };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [selectedDate, setSelectedDate] = useState<Date | null>(
    value ? new Date(value) : null
  );

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 100 }, (_, i) => 2024 - i + 50); // 1974 to 2074

  // Get days in current month
  const daysInMonth = new Date(currentDate.year, currentDate.month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.year, currentDate.month, 1).getDay();
  
  // Create array of days
  const days = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentDate.year, currentDate.month, day);
    setSelectedDate(newDate);
    const formattedDate = `${currentDate.year}-${String(currentDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(formattedDate);
    onClose();
  };

  const handleMonthChange = (month: number) => {
    setCurrentDate(prev => ({ ...prev, month }));
  };

  const handleYearChange = (year: number) => {
    setCurrentDate(prev => ({ ...prev, year }));
  };

  const goToPreviousMonth = () => {
    setCurrentDate(prev => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { ...prev, month: prev.month - 1 };
    });
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { ...prev, month: prev.month + 1 };
    });
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.month === today.getMonth() &&
      currentDate.year === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      currentDate.month === selectedDate.getMonth() &&
      currentDate.year === selectedDate.getFullYear()
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-80">
      {/* Header with Year and Month */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        
        <div className="flex items-center gap-2">
          <select
            value={currentDate.year}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            className="bg-transparent border-0 text-lg font-medium focus:outline-none cursor-pointer"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          
          <select
            value={currentDate.month}
            onChange={(e) => handleMonthChange(Number(e.target.value))}
            className="bg-transparent border-0 text-lg font-medium focus:outline-none cursor-pointer"
          >
            {months.map((month, index) => (
              <option key={index} value={index}>{month}</option>
            ))}
          </select>
        </div>
        
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <div
            key={index}
            className={cn(
              "h-10 w-10 flex items-center justify-center text-sm rounded-lg transition-colors",
              day === null && "invisible", // Empty cells
              day !== null && "cursor-pointer hover:bg-gray-100",
              day !== null && isToday(day) && "bg-gray-100 font-medium",
              day !== null && isSelected(day) && "bg-gray-900 text-white hover:bg-gray-900"
            )}
            onClick={() => day && handleDateSelect(day)}
          >
            {day}
          </div>
        ))}
      </div>
    </div>
  );
};
