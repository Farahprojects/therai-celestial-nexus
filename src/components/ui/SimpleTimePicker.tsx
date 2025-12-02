import React, { useState } from 'react';

interface SimpleTimePickerProps {
  value?: string; // HH:MM format
  onChange: (time: string) => void;
  onClose: () => void;
  hasError?: boolean;
}

export const SimpleTimePicker: React.FC<SimpleTimePickerProps> = ({
  value,
  onChange,
  onClose
}) => {
  const [hour, setHour] = useState(() => {
    if (value) {
      const h = parseInt(value.split(':')[0]);
      return h > 12 ? h - 12 : (h === 0 ? 12 : h);
    }
    return 12;
  });

  const [minute, setMinute] = useState(() => {
    if (value) {
      return parseInt(value.split(':')[1]) || 0;
    }
    return 0;
  });

  const [ampm, setAmpm] = useState(() => {
    if (value) {
      const h = parseInt(value.split(':')[0]);
      return h >= 12 ? 'PM' : 'AM';
    }
    return 'AM';
  });

  const handleConfirm = () => {
    let hour24 = hour;
    if (ampm === 'PM' && hour !== 12) hour24 += 12;
    if (ampm === 'AM' && hour === 12) hour24 = 0;
    
    const timeString = `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    onChange(timeString);
    onClose();
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-64">
      <div className="text-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Select Time</h3>
      </div>

      <div className="flex items-center justify-center gap-4 mb-6">
        {/* Hour */}
        <div className="text-center">
          <div className="text-sm text-gray-500 mb-2">Hour</div>
          <select
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="bg-transparent border-0 text-2xl font-medium focus:outline-none cursor-pointer text-center"
          >
            {hours.map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>

        <div className="text-2xl font-medium text-gray-400">:</div>

        {/* Minute */}
        <div className="text-center">
          <div className="text-sm text-gray-500 mb-2">Minute</div>
          <select
            value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
            className="bg-transparent border-0 text-2xl font-medium focus:outline-none cursor-pointer text-center"
          >
            {minutes.map(m => (
              <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
            ))}
          </select>
        </div>

        {/* AM/PM */}
        <div className="text-center">
          <div className="text-sm text-gray-500 mb-2">Period</div>
          <select
            value={ampm}
            onChange={(e) => setAmpm(e.target.value)}
            className="bg-transparent border-0 text-2xl font-medium focus:outline-none cursor-pointer text-center"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          Confirm
        </button>
      </div>
    </div>
  );
};
