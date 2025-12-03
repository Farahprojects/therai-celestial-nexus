# RLS Policy Reference Files

These files contain the optimized, consolidated RLS policies for reference purposes. Each file represents the recommended policy structure after consolidating multiple permissive policies into efficient merged policies.

## 📁 Reference Files

### `chat_folders_policies.sql`
- **3 SELECT policies → 1 merged** policy for owners/participants/public access
- Service role full access
- Uses `(select auth.uid())` optimization pattern

### `insights_policies.sql`
- Folder-based access inheritance
- Users can access insights in folders they own
- Service role full access

### `report_logs_policies.sql`
- Conversation-based access control
- Supports public conversations + owner/participant access
- Global logs (chat_id IS NULL) always accessible

### `user_memory_buffer_policies.sql`
- Strict user isolation: `(select auth.uid()) = user_id`
- Each user can only access their own memory buffer records

### `user_memory_policies.sql`
- Strict user isolation: `(select auth.uid()) = user_id`
- Each user can only access their own memory records

### `payment_method_policies.sql`
- Strict user isolation: `(select auth.uid()) = user_id`
- No DELETE policy for users (service role only)
- Payment methods can only be managed by their owners

### `profiles_policies.sql`
- Strict user isolation: `(select auth.uid()) = id`
- Users can SELECT/UPDATE their own profile only
- INSERT reserved for service role (auth triggers handle profile creation)

### `stripe_products_policies.sql`
- Public read access for product catalog (anon + authenticated)
- Service role full management access
- Dynamic policy recreation with table existence check

### `topup_logs_policies.sql`
- Schema-aware conditional logic based on user_id column existence
- User isolation when user_id exists, deny access when missing
- Service role full access, no user DELETE (audit trail protection)

### `credit_tables_policies.sql`
- Multi-table policies for user_credits and credit_transactions
- user_credits: user can view/update own credits (no create/delete)
- credit_transactions: user can only view own transactions (service-only modifications)
- Schema-aware with column existence checks

### `translator_logs_policies.sql` ⭐ **CORRECTED**
- Conversation-based access control via chat_id → conversations.user_id
- Users can only view translator logs for conversations they own (SELECT only)
- **CRITICAL**: No INSERT/UPDATE/DELETE for authenticated users - service role only
- Safe policy cleanup removing unintended authenticated INSERT access
- Exception handling for robust deployment

### `password_reset_tokens_policies.sql`
- Security-sensitive table for password reset functionality
- Public SELECT access for token verification (required for reset flows)
- All modifications (INSERT/UPDATE/DELETE) restricted to service role only
- Exception-handled policy cleanup for safe deployment

### `user_memory_weekly_summaries_policies.sql`
- Weekly memory summary access with user isolation
- Users can SELECT and DELETE their own weekly summaries
- No INSERT/UPDATE for users (service-managed summaries)
- Service role has full access for summary generation

### `policy_consolidation_cleanup.sql` 🧹
- **Critical maintenance script** for removing duplicate permissive SELECT policies
- **Performance optimization** by reducing RLS evaluation overhead
- **Safe cleanup** with exception handling for each policy drop
- **Comprehensive coverage** across 13+ tables with redundant policies
- **Preserves access** while eliminating unnecessary policy evaluations

### `auth_uid_optimization.sql` ⚡
- **Final performance optimization** recommended by database advisors
- **Updates 40+ policies** across 14 tables to use `(SELECT auth.uid())` pattern
- **Reduces function evaluation overhead** in RLS queries
- **Improves query planning** and execution performance
- **Covers all major tables**: calendar_sessions, user profiles, AI features, conversations, folders
- **Includes complex realtime messaging policies**

### `voice_usage_policies.sql`
- Voice usage tracking with user isolation
- Users can view their own voice usage statistics
- Service role has full management access
- Idempotent policy creation with safe cleanup

### `user_memory_monthly_summaries_policies.sql`
- Monthly memory summary access with user isolation
- Users can SELECT and DELETE their own monthly summaries
- Service role has full management access for automated generation
- Controlled user deletion with service oversight

### `plan_limits_policies.sql`
- Subscription plan limits configuration
- Public read access for all users (anon + authenticated) to view available plans
- Service role has exclusive management access
- Essential for subscription/billing system transparency

### `system_prompts_policies.sql` 🔒
- **Critical security**: AI system prompts locked down to service role only
- **Complete policy reset**: Drops ALL existing policies for clean slate
- **Edge Functions access**: Only service operations can manage AI prompts
- **Zero user access**: No authenticated or anonymous access to system prompts
- **AI security foundation**: Protects sensitive prompt engineering data

### `conversation_activity_policies.sql` 📊
- **Operational analytics**: Conversation activity data for internal use only
- **Service-exclusive access**: Only backend operations can track activity
- **Complete policy reset**: Removes any user-facing policies
- **Analytics foundation**: Supports conversation monitoring and insights

### `password_reset_tokens_policies_v2.sql` 🔐
- **Security enhancement**: Moved from public SELECT to service-only access
- **Backend verification**: Token validation now handled server-side only
- **Complete lockdown**: No direct database access for token checking
- **Security best practice**: Prevents token enumeration attacks

### `folder_documents_policies.sql` 📁
- **Double-verification security**: Document ownership + folder ownership required for both UPDATE and DELETE
- **Strict modification controls**: Users can only update/delete documents they own in folders they own
- **Prevents cross-folder access**: Cannot modify documents in shared or foreign folders
- **Granular permission model**: Fine-grained access control for collaborative documents
- **Consistent security model**: UPDATE and DELETE policies use identical ownership verification

### `user_images_policies.sql` 🖼️
- **User image management**: Update access for personal images
- **Conditional creation**: Only creates policy if it doesn't exist
- **Safe deployment**: Idempotent policy creation pattern
- **Personal content control**: Users can modify their own image uploads

### `admin_role_management.sql` 👑
- **Complete admin system**: Role-based access control for administrators
- **Helper function**: `is_admin()` checks current user's admin status
- **Security definer**: Function runs with elevated privileges
- **Admin-only policies**: Full CRUD on user_roles table for admins only
- **Performance indexes**: Optimized queries for role checks
- **Conditional creation**: Safe, idempotent policy deployment

## 🚀 Performance Optimizations

All policies use:
- **`(select auth.uid())` pattern** for better query optimization
- **Consolidated permissive policies** to reduce RLS evaluation overhead
- **Service role policies** for admin operations

## 📋 Usage

These are reference implementations. The actual policies have been deployed separately. Use these files for:
- Documentation
- Future policy audits
- Understanding access patterns
- Troubleshooting RLS issues

## 🔒 Security Notes

- All policies maintain the same security guarantees as before
- Access rules are unchanged - only execution is optimized
- Service role maintains full administrative access
