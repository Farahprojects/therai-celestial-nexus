import React from 'react';

interface TransitMetadataProps {
  transits: {
    datetime_utc?: string;
    timezone?: string;
  };
}

export const TransitMetadata: React.FC<TransitMetadataProps> = ({ transits }) => {
  if (!transits) return null;

  const { datetime_utc, timezone } = transits;

  const formattedDate = datetime_utc 
    ? new Date(datetime_utc).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      }) 
    : 'N/A';

  return (
    <div className="text-xs md:text-sm text-gray-600 mb-6 bg-gray-50 p-3 rounded-lg border">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center">
        <p className="mb-1 md:mb-0">
          <span className="font-semibold text-gray-800">Transit Date:</span> {formattedDate}
        </p>
        {timezone && (
          <p>
            <span className="font-semibold text-gray-800">Timezone:</span> {timezone}
          </p>
        )}
      </div>
    </div>
  );
};
