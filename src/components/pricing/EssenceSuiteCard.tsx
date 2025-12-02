import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EssenceSuiteCardProps {
  getPriceById: (id: string) => { unit_price_usd?: number } | null;
  formatPrice: (price: number) => string;
}

const EssenceSuiteCard = ({ getPriceById, formatPrice }: EssenceSuiteCardProps) => {
  // Get live pricing for the suite - use professional as representative price
  const suitePrice = getPriceById('essence_professional');
  
  // Debug logging
  console.log('🔍 EssenceSuiteCard - Suite price:', suitePrice);
  
  const displayPrice = suitePrice?.unit_price_usd || 0;

  return (
    <Card className="shadow-sm border-gray-200 border h-full bg-white">
      <CardHeader className="flex flex-row items-start gap-4">
        <Badge className="bg-white text-black border border-gray-300 mb-2 px-3 py-1 font-light transition-colors duration-200 hover:bg-black hover:text-white">Most Popular for Coaches</Badge>
        <Users className="w-8 h-8 text-gray-600 ml-auto" />
      </CardHeader>
      <CardContent>
        <CardTitle className="text-2xl mb-2 font-light text-gray-900 tracking-tight">Client Essence Suite</CardTitle>
        <CardDescription className="mb-4 text-gray-700 font-light">
          <span className="font-normal text-gray-900">Whole-client analysis</span>: Access <span className="font-normal">Personal</span>, <span className="font-normal">Professional</span>, and <span className="font-normal">Relational</span> insights, all from a single birth chart. 
        </CardDescription>
        <ul className="list-disc list-inside text-gray-700 mb-5 font-light">
          <li>360° coaching foundation in one step</li>
          <li>Unlock three layers of every client</li>
          <li>Personal, career, and relationship blind spots</li>
          <li>Enhances onboarding and discovery</li>
        </ul>
        <div className="flex flex-col md:flex-row md:items-end md:gap-4 mt-4">
          <div className="text-3xl font-light text-gray-900">
            {displayPrice > 0 ? formatPrice(displayPrice) : '$--'}
          </div>
          <span className="text-gray-500 text-sm mt-1 md:mt-0 font-light">per client, includes all three perspectives</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default EssenceSuiteCard;
