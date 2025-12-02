
import React from "react";
import { Badge } from "@/components/ui/badge";
import DocSection from "./DocSection";

const RateLimitsSection: React.FC = () => {
  return (
    <DocSection id="rate-limits" title="Rate Limits">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-semibold">Starter Plan</h4>
            <p className="text-sm text-gray-600">Basic natal chart calculations</p>
          </div>
          <Badge variant="default">50,000 calls/month</Badge>
        </div>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-semibold">Growth Plan</h4>
            <p className="text-sm text-gray-600">Advanced calculations & transit forecasts</p>
          </div>
          <Badge variant="secondary">200,000 calls/month</Badge>
        </div>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <h4 className="font-semibold">Professional Plan</h4>
            <p className="text-sm text-gray-600">Full feature access</p>
          </div>
          <Badge variant="outline">750,000 calls/month</Badge>
        </div>
      </div>
    </DocSection>
  );
};

export default RateLimitsSection;
