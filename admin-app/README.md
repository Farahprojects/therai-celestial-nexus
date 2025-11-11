# TherAI Admin Dashboard

A standalone admin dashboard for monitoring system resources and managing users, subscriptions, credits, and roles.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file with your Supabase credentials:
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

3. Run the development server:
```bash
npm run dev
```

The admin dashboard will be available at http://localhost:3001

## Features

- Resource Monitoring (Database, Storage, Edge Functions, Bandwidth)
- User Management (Search, View, Filter)
- Subscription Management (View, Override Plans)
- Credit Management (Add/Remove Credits)
- Role Management (Assign/Revoke Admin)
- Activity Logs (Admin Logs, API Usage)

## Admin Access

Only users with the `admin` role in the `user_roles` table can access this dashboard.




