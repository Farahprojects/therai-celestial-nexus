import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';

/**
 * Simple public header for legal pages that should appear public to all users
 * regardless of authentication state
 */
const PublicHeader = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 w-full h-16 bg-white z-50 shadow-sm border-b">
      <div className="px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between items-center h-full">
          {/* Left section - Logo */}
          <div className="flex items-center">
            <Link to="/">
              <Logo />
            </Link>
          </div>
          
          {/* Right section - Public navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              to="/pricing" 
              className="text-gray-700 hover:text-gray-900 transition-all duration-300 ease-out hover:translate-y-[-1px] transform text-sm font-medium group relative"
            >
              <span className="relative">
                Pricing
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 ease-out group-hover:w-full"></span>
              </span>
            </Link>
            <Link 
              to="/blog" 
              className="text-gray-700 hover:text-gray-900 transition-all duration-300 ease-out hover:translate-y-[-1px] transform text-sm font-medium group relative"
            >
              <span className="relative">
                Blog
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 ease-out group-hover:w-full"></span>
              </span>
            </Link>
            <Link 
              to="/about" 
              className="text-gray-700 hover:text-gray-900 transition-all duration-300 ease-out hover:translate-y-[-1px] transform text-sm font-medium group relative"
            >
              <span className="relative">
                About
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 ease-out group-hover:w-full"></span>
              </span>
            </Link>
            <Link 
              to="/contact"
              className="text-gray-700 hover:text-gray-900 transition-all duration-300 ease-out hover:translate-y-[-1px] transform text-sm font-medium group relative"
            >
              <span className="relative">
                Contact
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 ease-out group-hover:w-full"></span>
              </span>
            </Link>
            <Link 
              to="/legal" 
              className="text-gray-700 hover:text-gray-900 transition-all duration-300 ease-out hover:translate-y-[-1px] transform text-sm font-medium group relative"
            >
              <span className="relative">
                Legal
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-900 transition-all duration-300 ease-out group-hover:w-full"></span>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default PublicHeader;
