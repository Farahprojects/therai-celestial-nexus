# Documentation

This directory contains all project documentation organized by category and feature area.

## Directory Structure

```
docs/
├── architecture/          # System architecture and design docs
├── database/             # Database schemas, migrations, and optimizations
├── features/             # Feature implementation docs (organized by domain)
│   ├── ai/              # AI/ML features and integrations
│   ├── audio/           # Audio and Bluetooth functionality
│   ├── billing/         # Payment and subscription systems
│   ├── blog/            # Blog and content management
│   ├── chat/            # Chat and messaging features
│   ├── integrations/    # Third-party service integrations
│   ├── mobile/          # Mobile and cross-platform features
│   ├── platform/        # Platform infrastructure and tools
│   ├── realtime/        # Real-time features and WebSocket
│   ├── roadmap/         # Product planning and roadmaps
│   ├── testing/         # Testing and debugging guides
│   └── ui/              # User interface and UX improvements
└── README.md            # This file
```

## Categories

### Architecture (`docs/architecture/`)
- System design and architecture decisions
- Performance optimizations and caching
- Scaling strategies and load balancing
- Real-time system implementations
- Memory management and optimization
- WebSocket and networking architecture

### Database (`docs/database/`)
- Database schema documentation
- Migration strategies and versioning
- Security policies and RLS implementation
- Performance optimizations and indexing
- Troubleshooting guides and diagnostics

### Features (`docs/features/`)

#### AI & Machine Learning (`ai/`)
- Gemini API integration and caching
- LLM provider management and switching
- Together Mode implementation and fixes

#### Audio & Bluetooth (`audio/`)
- Bluetooth audio routing and connectivity
- Voice tracking and audio processing
- Audio system deployment and optimization

#### Billing & Payments (`billing/`)
- Credit system implementation and management
- Subscription plans and A/B testing
- Payment processing and monetization

#### Blog & Content (`blog/`)
- Blog content strategy and management
- Content creation and publishing workflows
- UI/UX improvements for content features

#### Chat System (`chat/`)
- Chat optimization and performance
- Message sending and real-time updates
- Chat interface and user experience

#### Third-party Integrations (`integrations/`)
- Firebase integration and migration
- External service configurations
- API integration guides and troubleshooting

#### Mobile & Cross-platform (`mobile/`)
- Capacitor deployment and configuration
- Mobile-specific features and optimizations
- Cross-platform development guides

#### Platform Infrastructure (`platform/`)
- Email configuration and delivery
- SEO optimization and marketing
- Development tools and credentials
- Edge function analysis and optimization

#### Real-time Features (`realtime/`)
- Real-time data synchronization
- WebSocket implementations and fixes
- Live feature updates and polling strategies

#### Product Roadmap (`roadmap/`)
- Product planning and feature roadmaps
- Development ideas and feature requests
- Formula calculations and business logic

#### Testing & Debugging (`testing/`)
- Feature testing guides and examples
- Debugging tools and techniques
- Quality assurance and validation

#### User Interface (`ui/`)
- UI component implementations
- User experience improvements
- Interface optimization and fixes

## Quick Access

### Recent Important Docs
- [Database Optimization Summary](./architecture/DATABASE_OPTIMIZATION_SUMMARY.md)
- [Real-time Optimization Complete](./architecture/REALTIME_OPTIMIZATION_COMPLETE.md)
- [Memory System Improvements](./architecture/MEMORY_SYSTEM_IMPROVEMENTS.md)
- [Security Implementation](./database/SECURITY.md)

### Popular Feature Areas
- **AI Features**: [Gemini Integration](./features/ai/GEMINI_CONTEXT_CACHING_IMPLEMENTATION.md)
- **Mobile**: [Capacitor Setup](./features/mobile/CAPACITOR_LAUNCH_CHECKLIST.md)
- **Billing**: [Subscription Plans](./features/billing/PLUS_PLAN_AB_TEST_IMPLEMENTATION.md)
- **Blog**: [Content Strategy](./features/blog/BLOG_CONTENT_STRATEGY.md)

## Contributing

When adding new documentation:
1. Choose the appropriate category (architecture/database/features)
2. Use descriptive filenames with dates when applicable
3. Include implementation details, decisions, and future considerations
4. Update this README if adding new categories
