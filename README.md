# Therai - Celestial Nexus

Auto-sync enabled! 🚀

An AI-driven astrology platform that provides personalized insights and reports based on birth details and astrological data.

## Features

- **Personalized Astrology Reports**: Generate detailed reports based on birth date, time, and location
- **AI-Powered Insights**: Advanced AI analysis of astrological data
- **Modern UI/UX**: Clean, elegant interface built with React and Tailwind CSS
- **Mobile Responsive**: Optimized for all devices
- **Real-time Processing**: Instant report generation and delivery
- **React + Vite frontend**
- **Supabase backend**
- **Error handling improvements**
- **Auto-sync with GitHub**

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Radix UI
- **Backend**: Supabase (Database, Auth, Functions)
- **AI/ML**: Custom AI models for astrological analysis
- **Deployment**: Vercel

## Project Structure

```
therai-celestial-nexus/
├── src/                    # Frontend source code
├── supabase/              # Backend (migrations, functions, config)
├── database/              # Database queries and schema files
│   ├── queries/          # SQL diagnostic and check scripts
│   └── schema/           # Database schema definitions
├── docs/                  # Documentation organized by category
│   ├── architecture/     # System design and architecture docs
│   ├── database/         # Database and migration docs
│   └── features/         # Feature implementation docs
├── scripts/              # Build and utility scripts
├── auth-app/            # Authentication interface
└── public/              # Static assets and service worker
```

### Key Directories

- **`supabase/migrations/`**: Official database migrations (managed by Supabase)
- **`database/queries/`**: Diagnostic SQL scripts and health checks
- **`docs/`**: Comprehensive documentation organized by topic
- **`scripts/sql/`**: Operational SQL scripts and utilities

## Prerequisites

- **Node.js**: Version 20.19.0 or higher (required by Vite)
- **npm**: Latest stable version
- **Supabase Account**: For backend services and database
- **Stripe Account**: For payment processing (optional for development)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Farahprojects/therai-celestial-nexus.git
cd therai-celestial-nexus
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Copy the example environment file and configure your variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual values:

- **VITE_SUPABASE_URL**: Your Supabase project URL
- **VITE_SUPABASE_ANON_KEY**: Your Supabase anonymous key
- **VITE_STRIPE_PUBLISHABLE_KEY**: Your Stripe publishable key (for payments)

**Note**: The Supabase URL and anon key have default fallback values pointing to the production instance, but you should set up your own Supabase project for development.

### 4. Supabase Setup

#### Option A: Use Default Production Supabase (Limited)
The app will work with the default Supabase configuration for basic testing, but you'll have limited access to backend features.

#### Option B: Set Up Your Own Supabase Project (Recommended)

1. **Create a new Supabase project** at [supabase.com](https://supabase.com)

2. **Update your environment variables** with your project's URL and anon key

3. **Run database migrations**:
   ```bash
   # Install Supabase CLI
   npm install -g supabase

   # Link to your project
   supabase link --project-ref your-project-id

   # Apply migrations
   supabase migration up
   ```

4. **Deploy edge functions** (if needed for development):
   ```bash
   supabase functions deploy
   ```

### 5. Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (default Vite port).

### 6. Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm run generate-sitemap` - Generate sitemap for SEO

### Project Structure

```
therai-celestial-nexus/
├── src/
│   ├── components/          # Reusable UI components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API and external service integrations
│   ├── stores/             # Zustand state management
│   ├── utils/              # Utility functions
│   ├── integrations/       # Third-party service integrations
│   └── types.ts            # TypeScript type definitions
├── supabase/
│   ├── functions/          # Edge functions
│   ├── migrations/         # Database migrations
│   └── config.toml         # Supabase configuration
├── public/                 # Static assets
├── packages/               # Shared packages (shared-ui)
└── ios/android/           # Mobile app builds
```

## Troubleshooting

### Common Issues

**Build Errors:**
- Ensure you're using Node.js 20.19.0 or higher
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

**Supabase Connection Issues:**
- Verify your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Check that your Supabase project is active
- Ensure Row Level Security (RLS) policies are properly configured

**Environment Variables Not Loading:**
- Environment variables must be prefixed with `VITE_` to be accessible in the frontend
- Restart the development server after adding new environment variables
- Use `.env.local` for local development (not committed to git)

**Stripe Payment Issues:**
- Ensure `VITE_STRIPE_PUBLISHABLE_KEY` is set correctly
- Verify the key matches your Stripe account mode (test/live)

**Mobile App Issues:**
- For Capacitor builds, ensure you have Android Studio (Android) or Xcode (iOS) installed
- Run `npx cap sync` after installing dependencies

### Development Tips

- Use `npm run build:dev` for development builds with source maps
- Enable React DevTools for debugging component state
- Check browser console for detailed error messages
- Use the browser's network tab to inspect API calls

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STRIPE_PUBLISHABLE_KEY`
3. Deploy automatically on push to main branch

### Manual Deployment

```bash
# Build the application
npm run build

# Deploy the dist/ folder to your hosting provider
# (Netlify, Firebase Hosting, AWS S3, etc.)
```

### Mobile Apps

#### iOS
```bash
npx cap sync ios
npx cap open ios
# Open in Xcode and build
```

#### Android
```bash
npx cap sync android
npx cap open android
# Open in Android Studio and build
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes and test thoroughly
4. Run linting: `npm run lint`
5. Commit your changes: `git commit -m 'Add some feature'`
6. Push to the branch: `git push origin feature/your-feature-name`
7. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow the existing component patterns using Radix UI and Tailwind CSS
- Run ESLint before committing
- Write descriptive commit messages

### Testing

- Test on multiple devices and browsers
- Verify mobile responsiveness
- Test payment flows with Stripe test keys
- Ensure Supabase functions work correctly

## API Documentation

### Supabase Edge Functions

The application uses several Supabase Edge Functions located in `supabase/functions/`:

- `chat-send` - Handles AI chat interactions
- `generate-insights` - Creates personalized insights
- `report-orchestrator` - Manages report generation
- `stripe-webhook-handler` - Processes Stripe webhooks
- And many more...

Each function includes its own documentation in the function directory.

## Support

For support or questions:
- Check the troubleshooting section above
- Review existing issues on GitHub
- Create a new issue with detailed information

## License

Private project - All rights reserved.
