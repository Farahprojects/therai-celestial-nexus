// Shared mapping utilities
import { User as SupabaseUser } from '@supabase/supabase-js';
import { User, Project, Item, ItemType, Category, Platform } from '../../types';

// Database types
export interface DbProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio?: string | null;
  is_public?: boolean;
  display_name?: string | null;
  website_url?: string | null;
  links?: { label: string; url: string }[] | null;
}

export interface DbProject {
  id: string;
  user_id: string;
  name: string;
  website_url: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  like_count?: number;
  share_count?: number;
  github_url?: string | null;
  repo_name?: string | null;
  description_generated?: string | null;
  readme_content?: string | null;
  stars_count?: number | null;
  language?: string | null;
  tech_stack?: string[] | null;
  completeness_score?: number | null;
  last_pushed_at?: string | null;
  file_tree?: Record<string, unknown> | null;
  processing_status?: 'pending' | 'completed' | 'failed' | null;
  processing_error?: string | null;
}

export interface DbItem {
  id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  is_verified: boolean;
  author_id: string;
  created_at: string;
  downloads: number;
  project_id: string | null;
  profiles: DbProfile;
  projects?: DbProject | null;
}

export interface DbItemImplementation {
  id: string;
  item_id: string;
  platform: string;
  code: string;
  documentation: string;
}

// Map Supabase user to our User type
export function mapSupabaseUser(supabaseUser: SupabaseUser, profile?: DbProfile): User {
  const userMetadata = supabaseUser.user_metadata as Record<string, unknown> | undefined;
  return {
    id: supabaseUser.id,
    username:
      profile?.username ||
      (userMetadata?.user_name as string) ||
      supabaseUser.email?.split('@')[0] ||
      'user',
    email: supabaseUser.email || '',
    avatarUrl: profile?.avatar_url || (userMetadata?.avatar_url as string),
    bio: profile?.bio || undefined,
    isPublic: true, // All profiles are public
    displayName: profile?.display_name || undefined,
    websiteUrl: profile?.website_url || undefined,
    links: profile?.links || undefined,
  };
}

// Map database project to our Project type
export function mapDbProject(dbProject: DbProject): Project {
  return {
    id: dbProject.id,
    userId: dbProject.user_id,
    name: dbProject.name,
    websiteUrl: dbProject.website_url,
    description: dbProject.description || undefined,
    createdAt: dbProject.created_at,
    updatedAt: dbProject.updated_at,
    likeCount: dbProject.like_count ?? 0,
    shareCount: dbProject.share_count ?? 0,
    githubUrl: dbProject.github_url || undefined,
    repoName: dbProject.repo_name || undefined,
    descriptionGenerated: dbProject.description_generated || undefined,
    readmeContent: dbProject.readme_content || undefined,
    starsCount: dbProject.stars_count ?? undefined,
    language: dbProject.language || undefined,
    techStack: dbProject.tech_stack || undefined,
    completenessScore: dbProject.completeness_score ?? undefined,
    lastPushedAt: dbProject.last_pushed_at || undefined,
    fileTree: dbProject.file_tree || undefined,
    processingStatus: dbProject.processing_status || undefined,
    processingError: dbProject.processing_error || undefined,
  };
}

// Map database item to our Item type
export function mapDbItem(dbItem: DbItem, implementations: DbItemImplementation[]): Item {
  return {
    id: dbItem.id,
    title: dbItem.title,
    description: dbItem.description,
    category: dbItem.category as Category,
    type: dbItem.type as ItemType,
    isVerified: dbItem.is_verified,
    author: {
      id: dbItem.profiles.id,
      username: dbItem.profiles.username,
      email: '', // Email not exposed publicly
      avatarUrl: dbItem.profiles.avatar_url || undefined,
      bio: dbItem.profiles.bio || undefined,
      isPublic: dbItem.profiles.is_public || false,
      displayName: dbItem.profiles.display_name || undefined,
      websiteUrl: dbItem.profiles.website_url || undefined,
      links: dbItem.profiles.links || undefined,
    },
    createdAt: dbItem.created_at,
    downloads: dbItem.downloads,
    implementations: implementations.map((impl) => ({
      platform: impl.platform as Platform,
      code: impl.code,
      documentation: impl.documentation,
    })),
    projectId: dbItem.project_id || undefined,
    project: dbItem.projects ? mapDbProject(dbItem.projects) : undefined,
  };
}



