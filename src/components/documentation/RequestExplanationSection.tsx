
import React from "react";

const RequestExplanationSection: React.FC = () => {
  return (
    <div className="mt-6">
      <h3 className="font-semibold text-lg mb-2">What this command does:</h3>
      <ul className="list-disc ml-6 space-y-1">
        <li><code className="bg-gray-100 px-1">-X POST</code>: Specifies the HTTP method (required for sending data).</li>
        <li><code className="bg-gray-100 px-1">https://api.therai.co/swiss</code>: The endpoint URL for Swiss Ephemeris based calculations.</li>
        <li><code className="bg-gray-100 px-1">-H &quot;Authorization: Bearer &lt;YOUR-API-KEY&gt;&quot;</code>: Authenticates your request. Remember to replace the placeholder!</li>
        <li><code className="bg-gray-100 px-1">-H &quot;Content-Type: application/json&quot;</code>: Tells the API you&apos;re sending JSON data.</li>
        <li><code className="bg-gray-100 px-1">-d &apos;{"{...}"}&apos;</code>: Contains the JSON payload with your request details.</li>
      </ul>
    </div>
  );
};

export default RequestExplanationSection;
