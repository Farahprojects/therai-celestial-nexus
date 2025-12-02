import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BrainCircuit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DeeperInsightsCardProps {
  getPriceById: (id: string) => { unit_price_usd?: number } | null;
  formatPrice: (price: number) => string;
}

const DeeperInsightsCard = ({ getPriceById, formatPrice }: DeeperInsightsCardProps) => {
  // Get live pricing for deeper insights (using focus report as base)
  const focusPrice = getPriceById('focus');
  const mindsetPrice = getPriceById('mindset');
  
  // Calculate average price for deeper insights
  const totalPrice = (focusPrice?.unit_price_usd || 0) + (mindsetPrice?.unit_price_usd || 0);
  const averagePrice = totalPrice > 0 ? totalPrice / 2 : 0;

  return (
    <Card className="shadow-sm border-gray-200 border h-full bg-white">
      <CardHeader className="flex flex-row items-start gap-4">
        <Badge className="bg-white text-black border border-gray-300 mb-2 px-3 py-1 font-light transition-colors duration-200 hover:bg-black hover:text-white">AI-Powered Analysis</Badge>
        <BrainCircuit className="w-8 h-8 text-gray-600 ml-auto" />
      </CardHeader>
      <CardContent>
        <CardTitle className="text-2xl mb-2 font-light text-gray-900 tracking-tight">Deeper Insights Engine</CardTitle>
        <CardDescription className="mb-4 text-gray-700 font-light">
          Analyze journal entries, notes, and other client texts to uncover deep-seated psychological patterns and blind spots.
        </CardDescription>
        <ul className="list-disc list-inside text-gray-700 mb-5 font-light">
          <li>Go beyond the surface with AI-driven textual analysis</li>
          <li>Identify core themes, emotional tones, and cognitive habits</li>
          <li>Perfect for therapy, life coaching, and personal development</li>
        </ul>
        <div className="flex flex-col md:flex-row md:items-end md:gap-4 mt-4">
          <div className="text-3xl font-light text-gray-900">
            {averagePrice > 0 ? formatPrice(averagePrice) : '$--'}
          </div>
          <span className="text-gray-500 text-sm mt-1 md:mt-0 font-light">per analysis</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeeperInsightsCard;
