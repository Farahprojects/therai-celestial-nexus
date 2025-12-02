import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RelationshipDynamicsCardProps {
  getPriceById: (id: string) => { unit_price_usd?: number } | null;
  formatPrice: (price: number) => string;
}

const RelationshipDynamicsCard = ({ getPriceById, formatPrice }: RelationshipDynamicsCardProps) => {
  // Get live pricing for the suite - use personal compatibility as representative price
  const suitePrice = getPriceById('sync_personal');
  
  const displayPrice = suitePrice?.unit_price_usd || 0;

  return (
    <Card className="shadow-sm border-gray-200 border bg-white">
      <CardHeader className="flex flex-row items-start gap-4">
        <Badge className="bg-white text-black border border-gray-300 mb-2 px-3 py-1 font-light transition-colors duration-200 hover:bg-black hover:text-white">Unlock Compatibility</Badge>
        <Users className="w-8 h-8 text-gray-600 ml-auto" />
      </CardHeader>
      <CardContent>
        <CardTitle className="text-2xl mb-2 font-light text-gray-900 tracking-tight">Relationship Dynamics Suite</CardTitle>
        <CardDescription className="mb-4 text-gray-700 font-light">
          <span className="font-normal text-gray-900">Personal &amp; Professional Compatibility</span>: Get two types of compatibility insights for any pair — ideal for coaching on love, business partnerships, or team dynamics.
        </CardDescription>
        <ul className="list-disc list-inside text-gray-700 mb-5 font-light">
          <li>Support clients through relationship transitions</li>
          <li>Enhance group, couple, or workplace coaching</li>
          <li>Address personal &amp; career chemistry together</li>
        </ul>
        <div className="flex flex-col md:flex-row md:items-end md:gap-4 mt-4">
          <div className="text-3xl font-light text-gray-900">
            {displayPrice > 0 ? formatPrice(displayPrice) : '$--'}
          </div>
          <span className="text-gray-500 text-sm mt-1 md:mt-0 font-light">per analysis (includes both angles)</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default RelationshipDynamicsCard;
