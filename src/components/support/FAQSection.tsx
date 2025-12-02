import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FAQItem } from '@/constants/supportContent';

interface FAQSectionProps {
  faqs: FAQItem[];
}

export const FAQSection: React.FC<FAQSectionProps> = ({ faqs }) => {
  if (faqs.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-lg text-gray-600 font-light mb-4">
          No articles found
        </p>
        <p className="text-sm text-gray-500 font-light">
          Try adjusting your search or{' '}
          <a href="/contact" className="text-gray-900 underline hover:no-underline">
            contact us for help
          </a>
        </p>
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      {faqs.map((faq) => (
        <AccordionItem key={faq.id} value={faq.id} className="border-b border-gray-200">
          <AccordionTrigger className="py-6 text-left font-light text-gray-900 hover:no-underline hover:text-gray-900">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="pb-6 pt-2">
            <p className="text-gray-700 font-light leading-relaxed">
              {faq.answer}
            </p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
};

