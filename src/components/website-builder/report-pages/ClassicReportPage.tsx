
import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReportForm } from "@/components/shared/ReportForm";

interface ClassicReportPageProps {
  customizationData: any;
  coachSlug: string;
}

export const ClassicReportPage: React.FC<ClassicReportPageProps> = ({ 
  customizationData, 
  coachSlug 
}) => {
  const navigate = useNavigate();
  const themeColor = customizationData.themeColor || '#8B5CF6';
  const fontFamily = customizationData.fontFamily || 'Playfair Display';

  return (
    <div className="bg-cream-50 min-h-screen" style={{ fontFamily: `${fontFamily}, serif` }}>
      {/* Header with Back Button */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate(`/${coachSlug}`)}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Website</span>
            </Button>
            <div className="text-xl font-serif font-bold" style={{ color: themeColor }}>
              {customizationData.coachName || "Dr. Sarah Wilson"}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 sm:py-24 lg:py-32 bg-gradient-to-b from-amber-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="w-16 h-16 sm:w-24 sm:h-24 lg:w-32 lg:h-32 mx-auto mb-6 sm:mb-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500"></div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold mb-4 sm:mb-6 text-gray-900 leading-tight">
            {customizationData.reportTitle || "Discover Your Personal Insights"}
          </h1>
          <div className="w-16 sm:w-24 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto mb-4 sm:mb-6"></div>
          <p className="text-lg sm:text-xl lg:text-2xl mb-8 sm:mb-10 italic text-gray-700 leading-relaxed">
            {customizationData.reportSubtitle || "Unlock the wisdom within through our comprehensive personal assessment"}
          </p>
        </div>
      </section>

      {/* Report Form Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 lg:p-10 border">
            <ReportForm 
              coachSlug={coachSlug}
              themeColor={themeColor}
              fontFamily={fontFamily}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 sm:py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="text-lg sm:text-xl font-serif font-bold mb-2" style={{ color: themeColor }}>
            {customizationData.coachName || "Dr. Sarah Wilson"}
          </div>
          <p className="text-gray-400">Personalized insights for your journey</p>
        </div>
      </footer>
    </div>
  );
};
