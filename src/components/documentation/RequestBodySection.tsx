
import React from "react";

const RequestBodySection: React.FC = () => {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">2. Understanding the Request Body</h2>
      <p className="mb-4">
        The JSON data (<code className="bg-gray-100 px-2 py-1 rounded">-d</code>) tells the API what you want and for whom:
      </p>
      <ul className="list-disc ml-6 space-y-2">
        <li><code className="bg-gray-100 px-1">&quot;request&quot;: &quot;body_matrix&quot;</code>: Specifies the desired calculation/product. This is the key field to change when calling other endpoints.</li>
        <li><code className="bg-gray-100 px-1">&quot;birth_date&quot;: &quot;1981-01-15&quot;</code>: The date of birth in YYYY-MM-DD format.</li>
        <li><code className="bg-gray-100 px-1">&quot;birth_time&quot;: &quot;06:38&quot;</code>: The time of birth in 24-hour HH:MM format (local time for the location).</li>
        <li><code className="bg-gray-100 px-1">&quot;location&quot;: &quot;Melbourne, Australia&quot;</code>: A free-text place name. The API will automatically convert this to geographic coordinates (latitude/longitude).</li>
        <li><code className="bg-gray-100 px-1">&quot;system&quot;: &quot;western&quot;</code>: Specifies the astrological system (use &quot;vedic&quot; for the Lahiri sidereal system).</li>
      </ul>
    </div>
  );
};

export default RequestBodySection;
