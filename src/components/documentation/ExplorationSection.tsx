
import React from "react";

const ExplorationSection: React.FC = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">6. Exploring Other Endpoints</h2>
      <p className="mb-4">
        This fundamental pattern works for nearly all API calls:
      </p>
      <ul className="list-disc ml-6 space-y-2">
        <li>Use the correct Endpoint URL (e.g., <code className="bg-gray-100 px-1">https://api.theriaapi.com/swiss</code>).</li>
        <li>Include your API Key in the Authorization header.</li>
        <li>Send a JSON payload (<code className="bg-gray-100 px-1">-d</code>) containing:
          <ul className="list-disc ml-6 mt-2">
            <li>The desired <code className="bg-gray-100 px-1">&quot;request&quot;: &quot;...&quot;</code> value (e.g., &quot;natal&quot;, &quot;transits&quot;, &quot;relationship&quot;).</li>
            <li>The required birth data (birth_date, birth_time, location or lat/lon).</li>
            <li>Any endpoint-specific parameters.</li>
          </ul>
        </li>
      </ul>
      <p className="mt-4 font-medium text-lg text-primary">Now you&apos;re ready to explore!</p>
    </div>
  );
};

export default ExplorationSection;
