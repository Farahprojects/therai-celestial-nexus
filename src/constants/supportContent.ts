export type SupportCategory = 'getting-started' | 'billing' | 'features' | 'troubleshooting';

export interface FAQItem {
  id: string;
  category: SupportCategory;
  question: string;
  answer: string;
}

export interface SupportCategoryConfig {
  id: SupportCategory;
  title: string;
  description: string;
  icon: string;
}

export const supportCategories: SupportCategoryConfig[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Learn the basics of using Therai',
    icon: '',
  },
  {
    id: 'billing',
    title: 'Account & Billing',
    description: 'Subscriptions, payments, and plans',
    icon: '',
  },
  {
    id: 'features',
    title: 'App Features',
    description: 'Explore all Therai features',
    icon: '',
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Fix common issues',
    icon: '',
  },
];

export const faqData: FAQItem[] = [
  // Getting Started
  {
    id: 'gs-1',
    category: 'getting-started',
    question: 'How do I create my first astro chart?',
    answer: 'To create your first astro chart, click the pen icon or the "+ New Chat" button in the sidebar. Select "Generate Astro" and choose from chart types like The Self (essence), Compatibility (sync), Weekly Snap, or Daily Shot. Fill in the required birth data and Therai will generate your personalized astrological insights.',
  },
  {
    id: 'gs-2',
    category: 'getting-started',
    question: 'What chart types are available?',
    answer: 'Therai offers four main chart types: The Self (Essence) - combines natal and transit insights for deep self-understanding; Compatibility (Sync) - explores relationship dynamics and shared potential; Weekly Snap - provides weekly forecasts and energy shifts; and Daily Shot (Focus) - delivers daily focus and intention guidance.',
  },
  {
    id: 'gs-3',
    category: 'getting-started',
    question: 'How do I start a conversation with Therai?',
    answer: 'Simply type your question or message in the chat input box at the bottom of the screen and press Enter. Therai uses AI to provide personalized astrological insights based on your birth chart data. You can ask about your chart, request interpretations, or explore relationship dynamics.',
  },
  {
    id: 'gs-4',
    category: 'getting-started',
    question: 'What is voice conversation mode?',
    answer: 'Voice conversation mode allows you to have spoken conversations with Therai. Click the speaker icon to activate it. The AI will respond with voice playback, creating a more natural, flowing conversation experience. This feature costs 2 credits per interaction vs 1 credit for text chat.',
  },
  {
    id: 'gs-5',
    category: 'getting-started',
    question: 'How does profile setup work?',
    answer: 'After signing up, you can set up your profile with your name, birth details, and preferences. Navigate to Settings to add or update your birth information. Having accurate birth data ensures the most precise astrological calculations and personalized insights.',
  },

  // Account & Billing
  {
    id: 'bill-1',
    category: 'billing',
    question: 'What subscription plans do you offer?',
    answer: 'Therai offers two subscription plans: Growth ($10/month) includes unlimited AI conversations, Together Mode (2-person sessions), Premium HD Voice (10 min/month), image generation (3/day), and unlimited folders & sharing. Premium ($18/month) includes everything in Growth plus unlimited voice and image generation. Both plans are billed monthly and can be canceled anytime.',
  },
  {
    id: 'bill-2',
    category: 'billing',
    question: 'What\'s the difference between Growth and Premium?',
    answer: 'Growth ($10/month) includes unlimited AI conversations, Together Mode, 10 minutes of Premium HD Voice per month, 3 images per day, and unlimited folders & sharing. Premium ($18/month) includes everything in Growth plus unlimited voice conversations, unlimited image generation, priority support, and early access to new features.',
  },
  {
    id: 'bill-3',
    category: 'billing',
    question: 'How do I subscribe to a plan?',
    answer: 'Navigate to Settings > Billing to view available plans and subscribe. You can choose between Growth or Premium and complete your subscription securely through Stripe. Your subscription starts immediately upon payment confirmation.',
  },
  {
    id: 'bill-4',
    category: 'billing',
    question: 'Can I upgrade or downgrade my plan?',
    answer: 'Yes! You can change your subscription at any time. Upgrades from Growth to Premium take effect immediately, giving you unlimited voice and image generation. Downgrades take effect at your next billing cycle. We\'ll prorate any differences.',
  },
  {
    id: 'bill-5',
    category: 'billing',
    question: 'How do I cancel my subscription?',
    answer: 'You can cancel your subscription anytime in Settings > Billing. Cancellations take effect at the end of your current billing period, so you\'ll continue to have access until then. No refunds are provided for the current billing period.',
  },
  {
    id: 'bill-6',
    category: 'billing',
    question: 'Can I get a refund?',
    answer: 'Subscriptions are billed monthly with no refunds for partial periods. If you cancel mid-cycle, you\'ll retain access until the end of your billing period. For billing issues or disputes, please contact our support team through the Contact page.',
  },
  {
    id: 'bill-7',
    category: 'billing',
    question: 'What payment methods are accepted?',
    answer: 'We accept all major credit cards including Visa, MasterCard, American Express, and Discover. All payments are securely processed by Stripe, ensuring your financial information is protected with industry-standard encryption.',
  },

  // App Features
  {
    id: 'feat-1',
    category: 'features',
    question: 'How do I generate astro data?',
    answer: 'Click the pen icon or "+ New Chat", select "Generate Astro", choose your chart type, and fill in the required birth information. Therai uses Swiss Ephemeris data for precise calculations and delivers your astrological insights instantly.',
  },
  {
    id: 'feat-2',
    category: 'features',
    question: 'What\'s the difference between chart types?',
    answer: 'The Self (Essence) combines natal and transit data for comprehensive self-understanding. Compatibility (Sync) focuses on relationship dynamics between two people. Weekly Snap provides seven-day forecasts. Daily Shot (Focus) gives you targeted guidance for a specific date or intention.',
  },
  {
    id: 'feat-3',
    category: 'features',
    question: 'How do I use voice conversation mode?',
    answer: 'Click the speaker icon in the chat input area to activate voice conversation mode. Grant microphone permissions when prompted, then speak your message. Therai will respond with voice playback. To exit voice mode, click the speaker icon again.',
  },
  {
    id: 'feat-4',
    category: 'features',
    question: 'Is voice conversation mode available on all plans?',
    answer: 'Voice conversation mode is available on all paid plans. Growth plan ($10/month) includes 10 minutes of Premium HD Voice per month, while Premium plan ($18/month) includes unlimited voice conversations. Upgrade in Settings > Billing to access voice features.',
  },
  {
    id: 'feat-5',
    category: 'features',
    question: 'How do I share a conversation?',
    answer: 'Click the share icon in the conversation header to generate a shareable link. You can copy the link to send to others via email, messaging, or social media. Recipients can view the conversation without requiring a Therai account.',
  },
  {
    id: 'feat-6',
    category: 'features',
    question: 'How do I organize conversations with folders?',
    answer: 'Create folders in your sidebar to organize conversations by topic, client (for coaches), or project. Drag conversations into folders or right-click a conversation to move it. This keeps your workspace tidy and makes finding past insights easier.',
  },
  {
    id: 'feat-7',
    category: 'features',
    question: 'What is "Together Mode" vs standard chat?',
    answer: 'Together Mode is a collaborative conversation mode where multiple participants can join. Standard chat is one-on-one with Therai. In Together Mode, use @therai to ask Therai to analyze the conversation and provide insights as a mediator.',
  },
  {
    id: 'feat-8',
    category: 'features',
    question: 'How do I use @therai in Together Mode?',
    answer: 'When in Together Mode, type @therai followed by your question or request in the chat input. Therai will analyze the conversation context and provide insights, reframing, or guidance as an AI mediator. This is perfect for couples, teams, or groups working through decisions together.',
  },
  {
    id: 'feat-9',
    category: 'features',
    question: 'Can I export my conversations?',
    answer: 'Currently, conversations can be shared via shareable links. Direct export functionality (PDF, text file) is on our roadmap. For now, you can copy conversation text manually or use the share link to access your conversations from any device.',
  },

  // Troubleshooting
  {
    id: 'trouble-1',
    category: 'troubleshooting',
    question: 'Connection issues ("Connection lost" errors)',
    answer: 'If you see "Connection lost" errors, check your internet connection first. Try refreshing the page or restarting the app. If problems persist, ensure your firewall or security software isn\'t blocking Therai\'s connections. Contact support if issues continue.',
  },
  {
    id: 'trouble-2',
    category: 'troubleshooting',
    question: 'Voice/microphone not working (permission issues)',
    answer: 'Voice mode requires microphone permissions. If prompted, click "Allow" in your browser\'s permission dialog. In your browser settings, ensure Therai has microphone access. On mobile, check app permissions in your device settings. Try refreshing the page after granting permissions.',
  },
  {
    id: 'trouble-3',
    category: 'troubleshooting',
    question: 'Audio playback problems',
    answer: 'If audio playback isn\'t working in voice mode, check your device\'s volume settings and ensure headphones aren\'t muted. Try refreshing the page or restarting voice mode. Some browsers require user interaction before playing audio - make sure you\'ve clicked somewhere on the page first.',
  },
  {
    id: 'trouble-4',
    category: 'troubleshooting',
    question: 'Messages not sending',
    answer: 'If messages aren\'t sending, check your internet connection. Ensure you have sufficient credits for the message type. Try refreshing the page. If the issue persists, clear your browser cache or try a different browser. Contact support if problems continue.',
  },
  {
    id: 'trouble-5',
    category: 'troubleshooting',
    question: '"Request timed out" errors',
    answer: 'Timeout errors usually indicate a slow internet connection or server load. Wait a moment and try again. Check your connection speed. If timeouts persist, try during off-peak hours or contact support for assistance.',
  },
  {
    id: 'trouble-6',
    category: 'troubleshooting',
    question: '"Server temporarily unavailable" errors',
    answer: 'Server errors (500, 502, 503) indicate temporary issues on our end. Please wait a few moments and try again. These usually resolve quickly. If you see repeated server errors, check our status page or contact support for updates.',
  },
  {
    id: 'trouble-7',
    category: 'troubleshooting',
    question: 'Chart generation failures',
    answer: 'If chart generation fails, verify your birth data is complete and accurate. Check that you have sufficient credits. Try generating a different chart type first. If issues persist, clear your browser cache and refresh the page. Contact support with the specific error message.',
  },
  {
    id: 'trouble-8',
    category: 'troubleshooting',
    question: 'Login/authentication issues',
    answer: 'If you can\'t log in, verify your email and password are correct. Try the "Forgot Password" link to reset your password. Clear browser cookies for therai.co if issues persist. Ensure JavaScript is enabled in your browser. Contact support if problems continue.',
  },
];

