import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Star, Award, Rocket, Linkedin } from "lucide-react";
import { normalizeStorageUrl } from "@/utils/storageUtils";
import { SEO } from "@/components/SEO";

const About = () => {
  return (
    <>
      <SEO
        title="About Us | AI-Powered Psychological Insights Platform | Therai"
        description="Learn about Therai's mission to create psychological insights through momentum using AI-powered astrology. An AI webapp that helps you understand yourself through natural cycles and energetic patterns."
        keywords="about therai, AI webapp, psychological insights, astrology, momentum, self-discovery, AI-powered insights"
        url="/about"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Therai',
          url: 'https://therai.co',
          logo: 'https://api.therai.co/storage/v1/object/public/therai-assets/logowhite.jpeg'
        }}
      />
      <div className="flex flex-col min-h-screen">
        <Navbar />
      
      <main className="flex-grow">
        {/* Header Section with Theme Color Gradient */}
        <section className="relative overflow-hidden bg-white py-32">
          <div className="container relative z-10 mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-light mb-6 text-gray-900 tracking-tight">
                Advancing the Future of Astrological Insight
              </h1>
              <p className="text-xl text-gray-700 mb-8 font-light">
                We build intelligent systems that refine, calculate, and decode the patterns behind astrology. Bridging ancient wisdom with modern technology.
              </p>
            </div>
          </div>
        </section>

        {/* Mission Section with White Background */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
              <h2 className="text-3xl font-light mb-8 text-center text-gray-900 tracking-tight">At Therai, our mission is to restore clarity through rhythm.</h2>
              <p className="text-lg mb-6 text-gray-700 font-light">
                We believe every breakthrough carries an energetic signature—a pattern waiting to be decoded. By blending lived experience with the intelligence of natural cycles, we guide people back into alignment—where insight, action, and timing converge.
              </p>
              <p className="text-lg mb-6 text-gray-700 font-light">
                True self-understanding doesn't come from overthinking—it comes from tuning in to the frequency that's been guiding you all along.
              </p>
            </div>
          </div>
        </section>

        {/* Team Section with Modern Cards */}
        <section className="py-24 bg-gradient-to-b from-background to-accent/20">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-light mb-16 text-center text-gray-900 tracking-tight">Our Team</h2>
            <div className="flex flex-col md:flex-row gap-12 max-w-4xl mx-auto justify-center">
              {/* Founder Card */}
              <div className="backdrop-blur-sm bg-white/50 rounded-2xl p-10 shadow-lg border border-white/20 hover:shadow-xl transition-all flex flex-col justify-between flex-1 max-w-md">
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 mb-6 rounded-full overflow-hidden flex items-center justify-center">
                    <img src={normalizeStorageUrl("https://api.therai.co/storage/v1/object/public/therai-assets/me.png")} alt="Peter Farah" className="object-cover w-24 h-24" loading="lazy" />
                  </div>
                  <h3 className="text-2xl font-light mb-2 text-gray-900 tracking-tight">Peter Farah</h3>
                  <p className="text-lg font-light text-gray-700 mb-2">Founder and Creator</p>
                  <p className="text-gray-600 mb-4 font-light">
                    Passionate entrepreneur blending technology, astrology, and psychology to build
                    innovative, user-focused platforms. Driven by curiosity, creativity, and a
                    commitment to deep understanding.
                  </p>
                  <p className="text-sm text-gray-500 mb-4">Australia</p>
                  {/* Social Media Icons */}
                  <div className="flex space-x-4 mt-2">
                    <a
                      href="https://www.linkedin.com/public-profile/settings?trk=d_flagship3_profile_self_view_public_profile"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-black hover:text-[#0077b5] transition-all duration-200 hover:scale-110"
                    >
                      <Linkedin className="w-5 h-5" />
                    </a>
                    <a
                      href="https://x.com/farahprojects"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-black hover:text-gray-700 transition-all duration-200 hover:scale-110"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>

              {/* OpenAI Support Card */}
              <div className="backdrop-blur-sm bg-white/50 rounded-2xl p-10 shadow-lg border border-white/20 hover:shadow-xl transition-all flex flex-col justify-between flex-1 max-w-md">
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 mb-6 rounded-full overflow-hidden flex items-center justify-center">
                    <img src={normalizeStorageUrl("https://api.therai.co/storage/v1/object/public/therai-assets/OpenAI-black-monoblossom.png")} alt="OpenAI Logo" className="object-contain w-20 h-20" loading="lazy" />
                  </div>
                  <h3 className="text-2xl font-light mb-2 text-gray-900 tracking-tight">OpenAI</h3>
                  <p className="text-lg font-light text-gray-700 mb-2">AI Platform Partner</p>
                  <p className="text-gray-600 font-light">
                    Therai is built with the help of OpenAI's advanced language models. While not a team member, OpenAI's platform empowers the creative and technical process—enabling new features, rapid prototyping, and smarter user experiences. We proudly use OpenAI as a core tool in our development journey.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Values Section with Cards */}
        <section className="py-24 bg-gradient-to-b from-accent/20 to-background">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-light mb-12 text-center text-gray-900 tracking-tight">Our Values</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="backdrop-blur-sm bg-white/50 rounded-xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all">
                  <h3 className="font-light text-xl mb-4 text-gray-900 tracking-tight">Accuracy</h3>
                  <p className="text-gray-700 font-light">
                    We are committed to providing the most precise astrological calculations
                    possible, based on the highest scientific standards.
                  </p>
                </div>
                <div className="backdrop-blur-sm bg-white/50 rounded-xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all">
                  <h3 className="font-light text-xl mb-4 text-gray-900 tracking-tight">Innovation</h3>
                  <p className="text-gray-700 font-light">
                    We continuously work to improve Therai and add new features that enable
                    innovative applications of astrological wisdom.
                  </p>
                </div>
                <div className="backdrop-blur-sm bg-white/50 rounded-xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all">
                  <h3 className="font-light text-xl mb-4 text-gray-900 tracking-tight">Accessibility</h3>
                  <p className="text-gray-700 font-light">
                    We believe in making astrological insights accessible to everyone,
                    creating user-friendly tools that serve people from all walks of life.
                  </p>
                </div>
                <div className="backdrop-blur-sm bg-white/50 rounded-xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all">
                  <h3 className="font-light text-xl mb-4 text-gray-900 tracking-tight">Reliability</h3>
                  <p className="text-gray-700 font-light">
                    Our platform is built for consistency and dependability, ensuring you can
                    trust our insights to guide your most important decisions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-light mb-8 text-gray-900 tracking-tight">Ready to Get Started?</h2>
            <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto font-light">
              Join thousands of users who are already discovering their cosmic insights with Therai.
            </p>
            <Link to="/login">
              <button className="bg-black text-white px-10 py-4 text-lg font-light rounded-full shadow-lg transition-all duration-300 hover:bg-gray-900 hover:scale-105 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-gray-400">
                Get Started
              </button>
            </Link>
          </div>
        </section>
      </main>
      
        <Footer />
      </div>
    </>
  );
};

export default About;
