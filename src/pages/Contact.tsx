import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { showToast } from "@/utils/notifications";

import { validateEmail } from "@/utils/authValidation";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";

const Contact = () => {
  const [searchParams] = useSearchParams();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    honeypot: "" // Invisible field to catch bots
  });
  const [formErrors, setFormErrors] = useState({
    name: false,
    email: false,
    subject: false,
    message: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // Clear "thank you" state when component mounts (on page refresh)
  useEffect(() => {
    // Remove submitted state from localStorage on refresh
    localStorage.removeItem("contactFormSubmitted");
    
    // Get the submitted status value only after the component mounts
    const hasSubmitted = localStorage.getItem("contactFormSubmitted");
    if (hasSubmitted === "true") {
      setSubmitted(true);
    }
  }, []);

  // Check for pre-filled form data from error handling
  useEffect(() => {
    const prefillData = localStorage.getItem("contactFormPrefill");
    if (prefillData) {
      try {
        const parsedData = JSON.parse(prefillData);
        console.log('📝 Found contact form prefill data:', parsedData);
        setFormData(prev => ({
          ...prev,
          name: parsedData.name || "",
          email: parsedData.email || "",
          subject: parsedData.subject || "",
          message: parsedData.message || ""
        }));
        // Clear the prefill data after using it
        localStorage.removeItem("contactFormPrefill");
        console.log('📝 Cleared contact form prefill data from localStorage');
      } catch (error) {
        console.error("Error parsing contact form prefill data:", error);
        localStorage.removeItem("contactFormPrefill");
      }
    }
  }, []);

  // Pre-fill subject from URL parameter
  useEffect(() => {
    const subjectParam = searchParams.get('subject');
    if (subjectParam) {
      setFormData(prev => ({
        ...prev,
        subject: subjectParam
      }));
    }
  }, [searchParams]);

  // Scroll to top when showing the thank you message
  useEffect(() => {
    if (submitted) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [submitted]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (attemptedSubmit) {
      setFormErrors(prev => ({
        ...prev,
        [name]: false
      }));
    }
  };

  const validateForm = (): boolean => {
    const errors = {
      name: !formData.name.trim(),
      email: !formData.email.trim() || !validateEmail(formData.email),
      subject: !formData.subject,
      message: !formData.message.trim(),
    };
    
    setFormErrors(errors);
    return !Object.values(errors).some(error => error);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptedSubmit(true);
    
    // Validate form before submission
    if (!validateForm()) {
      showToast({
        title: "Please check your form",
        description: "All fields are required and email must be valid.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);

    try {
      // Set a timeout to detect slow responses
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request is taking longer than expected, but we\'re still processing it.'));
        }, 5000); // 5 second timeout
      });

      // The actual fetch request
      // Use Supabase edge function via the client
      const fetchPromise = supabase.functions.invoke('contact-form-handler', {
        body: formData
      });

      // Show a processing toast after 3 seconds if still submitting
      const toastTimeoutId = setTimeout(() => {
        if (isSubmitting) {
          showToast({
            title: "Processing your message",
            description: "This is taking a bit longer than usual. Please wait..."
          });
        }
      }, 3000);

      // Race between timeout and actual fetch
      try {
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        clearTimeout(toastTimeoutId);
        
        const result = response as { data?: any; error?: any };
        if (result.error) {
          throw new Error(result.error.message || 'Failed to send message');
        }
        
        // IMPROVED: Immediately show success state without waiting for background operations
        setSubmitted(true);
        localStorage.setItem("contactFormSubmitted", "true");
        
        // Reset form after successful submission
        setFormData({ name: "", email: "", subject: "", message: "", honeypot: "" });
        setIsSubmitting(false);

      } catch (timeoutError) {
        // If it was our timeout error, show a non-destructive toast but don't treat it as a failure yet
        if (timeoutError instanceof Error && timeoutError.message.includes('taking longer than expected')) {
          showToast({
            title: "Please wait",
            description: "We're still processing your message. You'll see confirmation soon."
          });

          // Continue with the fetch in the background
          fetchPromise.then(response => {
            clearTimeout(toastTimeoutId);
            const bgResult = response as { data?: any; error?: any };
            if (bgResult.error) {
              throw new Error(bgResult.error.message || 'Server error');
            }
            // IMPROVED: Set submitted state immediately when we get a response
            setSubmitted(true);
            localStorage.setItem("contactFormSubmitted", "true");
            // Reset form after successful submission
            setFormData({ name: "", email: "", subject: "", message: "", honeypot: "" });
            setIsSubmitting(false);
          }).catch(actualError => {
            setIsSubmitting(false);
            showToast({
              title: "Something went wrong",
              description: actualError instanceof Error ? actualError.message : "We couldn't send your message. Please try again later.",
              variant: "destructive"
            });
          });
        } else {
          // Handle other errors
          throw timeoutError;
        }
      }
    } catch (error) {
      showToast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "We couldn't send your message. Please try again later.",
        variant: "destructive"
      });
      
      console.error("Error sending contact form:", error);
      setIsSubmitting(false);
    }
  };

  // Thank you message component
  const ThankYouMessage = () => (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
        <CheckCircle className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-3xl font-light text-gray-900 mb-4 tracking-tight">Thank You for Reaching Out</h2>
      <p className="text-lg text-gray-600 max-w-lg mb-6 font-light leading-relaxed">
        Your message has been successfully received. We appreciate your inquiry and will respond to you within 24 hours.
      </p>
    </div>
  );

  return (
    <>
      <SEO
        title="Contact Us | Get in Touch | Therai"
        description="Reach out to Therai about partnerships, support, or questions about our AI webapp for psychological insights. We're here to help you on your journey of self-discovery."
        keywords="contact therai, AI webapp support, psychological insights, partnership inquiry, customer support, astrology help"
        url="/contact"
      />
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-grow">
        {submitted ? (
          <ThankYouMessage />
        ) : (
          <>
            <section className="bg-white py-20 text-center">
              <h1 className="text-4xl font-light text-gray-900 md:text-5xl mb-4 tracking-tight">
                Get in Touch
              </h1>
              <p className="text-gray-600 text-lg font-light leading-relaxed">
                Reach out about partnerships, or anything else we can help with.
              </p>
            </section>

            <section className="py-16">
              <div className="container mx-auto max-w-2xl px-4">
                <div className="bg-white rounded-2xl border border-gray-200/50 p-8 shadow-lg shadow-gray-200/50 backdrop-blur-sm">
                  <h2 className="mb-8 text-2xl font-light text-gray-900 tracking-tight text-center">Send a Message</h2>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Honeypot field - invisible to humans but bots will fill it */}
                    <div className="absolute opacity-0 pointer-events-none">
                      <Label htmlFor="honeypot">Leave this empty</Label>
                      <Input 
                        id="honeypot" 
                        name="honeypot" 
                        value={formData.honeypot} 
                        onChange={handleChange} 
                        tabIndex={-1} 
                        autoComplete="off"
                      />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-sm font-light text-gray-700">
                          Name <span className="text-red-400 ml-1">*</span>
                        </Label>
                        <Input 
                          id="name" 
                          name="name" 
                          value={formData.name} 
                          onChange={handleChange} 
                          required 
                          placeholder="Enter your name"
                          className={`h-12 rounded-full border-gray-200 bg-gray-50/50 font-light placeholder:text-gray-400 focus:border-primary focus:bg-white transition-all duration-300 ${formErrors.name ? "border-red-300 bg-red-50/30" : ""}`}
                        />
                        {formErrors.name && (
                          <p className="text-xs text-red-500 flex items-center font-light">
                            <AlertCircle className="h-3 w-3 mr-1" /> Name is required
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-light text-gray-700">
                          Email Address <span className="text-red-400 ml-1">*</span>
                        </Label>
                        <Input 
                          type="email" 
                          id="email" 
                          name="email" 
                          value={formData.email} 
                          onChange={handleChange} 
                          required 
                          placeholder="your@email.com"
                          className={`h-12 rounded-full border-gray-200 bg-gray-50/50 font-light placeholder:text-gray-400 focus:border-primary focus:bg-white transition-all duration-300 ${formErrors.email ? "border-red-300 bg-red-50/30" : ""}`}
                        />
                        {formErrors.email && (
                          <p className="text-xs text-red-500 flex items-center font-light">
                            <AlertCircle className="h-3 w-3 mr-1" /> Valid email address is required
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-sm font-light text-gray-700">
                        Subject <span className="text-red-400 ml-1">*</span>
                      </Label>
                      <select
                        id="subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        className={`w-full h-12 rounded-full border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm font-light text-gray-700 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-300 ${formErrors.subject ? "border-red-300 bg-red-50/30" : ""}`}
                      >
                        <option value="" className="text-gray-400">Select a subject</option>
                        <option value="General Inquiry">General Inquiry</option>
                        <option value="Partnership">Partnership</option>
                        <option value="Billing">Billing</option>
                      </select>
                      {formErrors.subject && (
                        <p className="text-xs text-red-500 flex items-center font-light">
                          <AlertCircle className="h-3 w-3 mr-1" /> Subject is required
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message" className="text-sm font-light text-gray-700">
                        Message <span className="text-red-400 ml-1">*</span>
                      </Label>
                      <Textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={6}
                        placeholder="Tell us how we can help you..."
                        className={`rounded-3xl border-gray-200 bg-gray-50/50 font-light placeholder:text-gray-400 focus:border-primary focus:bg-white transition-all duration-300 resize-none ${formErrors.message ? "border-red-300 bg-red-50/30" : ""}`}
                      />
                      {formErrors.message && (
                        <p className="text-xs text-red-500 flex items-center font-light">
                          <AlertCircle className="h-3 w-3 mr-1" /> Message is required
                        </p>
                      )}
                    </div>

                    <Button 
                      type="submit" 
                      disabled={isSubmitting} 
                      className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white font-light text-base rounded-full transition-all duration-300 hover:scale-[1.02] border-0 shadow-lg shadow-gray-900/25"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </span>
                      ) : "Send Message"}
                    </Button>
                  </form>
                </div>
              </div>
            </section>
          </>
        )}
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Contact;
