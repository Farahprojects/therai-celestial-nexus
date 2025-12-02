
import UnifiedNavigation from './UnifiedNavigation';

// This is a wrapper component that uses UnifiedNavigation
// This exists for backward compatibility with pages that import Navbar directly
const Navbar = () => {
  return <UnifiedNavigation />;
};

export default Navbar;
