
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PublicHeader from "@/components/PublicHeader";
import Footer from "@/components/Footer";
import { SEO } from "@/components/SEO";
// Markdown support removed to reduce bundle size


type LegalDocument = {
  title: string;
  content: string;
  version: string;
  published_date: string;
}

const Legal = () => {
  const [documents, setDocuments] = useState<Record<string, LegalDocument>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLegalDocuments = async () => {
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .filter('is_current', 'eq', true);

      if (error) {
        return;
      }

      const docs = data.reduce((acc, doc) => ({
        ...acc,
        [doc.document_type]: {
          title: doc.title,
          content: doc.content,
          version: doc.version,
          published_date: new Date(doc.published_date).toLocaleDateString(),
        }
      }), {});

      setDocuments(docs);
      setLoading(false);
    };

    fetchLegalDocuments();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Legal Information | Privacy Policy & Terms of Service | Therai"
        description="Review Therai's Privacy Policy and Terms of Service. Learn how we protect your data and handle your information."
        keywords="therai privacy policy, therai terms of service, astrology privacy, data protection, legal information"
        url="/legal"
      />
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
      <main className="flex-grow">
        <section className="relative overflow-hidden bg-white py-24">
          <div className="container relative z-10 mx-auto px-4">
            <div className="mx-auto max-w-4xl">
              <h1 className="mb-12 text-4xl font-light italic text-gray-900 text-center">
                Legal information
              </h1>

              <Tabs defaultValue="privacy_policy" className="space-y-8">
                <TabsList className="w-full grid grid-cols-2 h-auto p-1 bg-gray-50 rounded-2xl border border-gray-200">
                  <TabsTrigger 
                    value="privacy_policy" 
                    className="rounded-xl py-3 font-light text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm transition-all"
                  >
                    Privacy Policy
                  </TabsTrigger>
                  <TabsTrigger 
                    value="terms_of_service" 
                    className="rounded-xl py-3 font-light text-gray-600 data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm transition-all"
                  >
                    Terms of Service
                  </TabsTrigger>
                </TabsList>

                {['privacy_policy', 'terms_of_service'].map((docType) => {
                  const doc = documents[docType];
                  return doc && (
                    <TabsContent key={docType} value={docType} className="mt-8">
                      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                        <div className="mb-6 flex justify-between items-start border-b border-gray-100 pb-6">
                          <h2 className="text-2xl font-light text-gray-900">{doc.title}</h2>
                          <div className="text-xs font-light text-gray-500 text-right">
                            <p>Version {doc.version}</p>
                            <p className="mt-1">Last updated: {doc.published_date}</p>
                          </div>
                        </div>
                        <ScrollArea className="h-[60vh]">
                          <div 
                            className="prose prose-slate max-w-none whitespace-pre-wrap font-light text-gray-700 leading-relaxed"
                          >
                            {doc.content}
                          </div>
                        </ScrollArea>
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            </div>
          </div>
        </section>
      </main>
        <Footer />
      </div>
    </>
  );
};

export default Legal;
