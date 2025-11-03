import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { CategoryCard } from '@/components/support/CategoryCard';
import { FAQSection } from '@/components/support/FAQSection';
import { Button } from '@/components/ui/button';
import { supportCategories, faqData, SupportCategory, FAQItem } from '@/constants/supportContent';
import { HelpCircle } from 'lucide-react';

const Support = () => {
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory | null>(null);
  const navigate = useNavigate();

  // Filter FAQs based on category
  const filteredFAQs = useMemo(() => {
    // Filter by category if one is selected
    if (selectedCategory) {
      return faqData.filter(faq => faq.category === selectedCategory);
    }
    return faqData;
  }, [selectedCategory]);

  const handleCategoryClick = (categoryId: SupportCategory) => {
    setSelectedCategory(categoryId);
    // Scroll to FAQ section
    setTimeout(() => {
      const element = document.getElementById('faq-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleContactClick = () => {
    navigate('/contact');
  };

  const handleClearFilters = () => {
    setSelectedCategory(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <h1 className="text-4xl md:text-5xl font-light text-gray-900 tracking-tight">
                How can we help you unlock Therai?
              </h1>
              <p className="text-xl text-gray-600 font-light leading-relaxed">
                Find answers to common questions and explore our features
              </p>
            </div>
          </div>
        </section>

        {/* Category Cards */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {supportCategories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    onClick={() => handleCategoryClick(category.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq-section" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              {/* Section Header with Active Filters */}
              <div className="mb-12 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-light text-gray-900 tracking-tight">
                    {selectedCategory 
                      ? supportCategories.find(c => c.id === selectedCategory)?.title || 'Support Articles'
                      : 'Support Articles'
                    }
                  </h2>
                  {selectedCategory && (
                    <button
                      onClick={handleClearFilters}
                      className="text-sm text-gray-600 hover:text-gray-900 font-light underline transition-colors"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              {/* FAQ Accordions */}
              <FAQSection faqs={filteredFAQs} searchQuery="" />
            </div>
          </div>
        </section>

        {/* Contact CTA Section */}
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center space-y-8">
              <div className="mx-auto w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-4">
                <HelpCircle className="h-8 w-8 text-white" />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl font-light text-gray-900 tracking-tight">
                  Still need help?
                </h2>
                <p className="text-lg text-gray-600 font-light leading-relaxed">
                  Can't find what you're looking for? Our support team is here to help.
                </p>
              </div>
              <Button
                onClick={handleContactClick}
                className="bg-gray-900 hover:bg-gray-800 text-white font-light text-base px-10 py-6 rounded-full transition-all duration-300 hover:scale-[1.02] border-0 shadow-lg shadow-gray-900/25"
              >
                Contact Us
              </Button>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default Support;

