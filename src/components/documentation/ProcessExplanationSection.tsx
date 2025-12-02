
import React from "react";

const ProcessExplanationSection: React.FC = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">3. What Happens Next (Simplified)</h2>
      <p className="mb-4">
        When you send this request:
      </p>
      <ol className="list-decimal ml-6 space-y-2">
        <li><span className="font-medium">Authentication</span>: The API gateway checks if your API key is valid.</li>
        <li><span className="font-medium">Interpretation</span>: It identifies the &quot;request&quot;: &quot;body_matrix&quot; and understands the birth details.</li>
        <li><span className="font-medium">Geocoding</span>: &quot;Melbourne, Australia&quot; is converted into latitude and longitude (using cached results where possible).</li>
        <li><span className="font-medium">Calculation</span>: The Swiss Ephemeris engine calculates the necessary astrological data (natal chart, transits, etc.) and applies the specific Body Matrix logic.</li>
        <li><span className="font-medium">Response</span>: The final results are packaged as a JSON object and sent back to you.</li>
      </ol>
    </div>
  );
};

export default ProcessExplanationSection;
