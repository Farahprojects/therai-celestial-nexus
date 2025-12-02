
import React from "react";
import SimpleCodeBlock from "./SimpleCodeBlock";

const CustomizationSection: React.FC = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">5. Customizing Your Request (Optional Shortcuts)</h2>
      <p className="mb-4">
        Need more control? Here are common adjustments:
      </p>
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Skip Geocoding: Provide precise coordinates instead of a place name:</h3>
          <SimpleCodeBlock 
            code={`"latitude": -37.8136,\n"longitude": 144.9631`}
            language="Json"
          />
        </div>
        <div>
          <h3 className="font-semibold mb-2">Analyze a Specific Date/Time: Calculate for a moment other than now:</h3>
          <SimpleCodeBlock 
            code={`"analysis_date": "2025-12-31",\n"analysis_time": "08:00" // Optional, defaults to noon if date is set but not time`}
            language="Json"
          />
        </div>
        <div>
          <h3 className="font-semibold mb-2">Use Vedic/Lahiri System: Switch the astrological system:</h3>
          <SimpleCodeBlock 
            code={`"system": "vedic"`}
            language="Json"
          />
        </div>
      </div>
    </div>
  );
};

export default CustomizationSection;
