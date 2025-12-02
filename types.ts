export type Platform = 'Supabase' | 'Firebase' | 'Cloudflare' | 'Vercel' | 'Universal' | 'Other';

export type Category = 'Auth' | 'Payments' | 'AI' | 'Database' | 'Storage' | 'Utility' | 'Rules' | 'Prompts';

export type ItemType = 'edge_function' | 'system_prompt' | 'schema' | 'rule';

export interface ProfileLink {
  label: string;
  url: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  isPublic?: boolean;
  // Creator-style fields (optional, driven by profiles table)
  displayName?: string;
  websiteUrl?: string;
  links?: ProfileLink[];
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  websiteUrl: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  likeCount?: number;
  shareCount?: number;
  // GitHub integration fields
  githubUrl?: string;
  repoName?: string;
  descriptionGenerated?: string;
  readmeContent?: string;
  starsCount?: number;
  language?: string;
  techStack?: string[];
  completenessScore?: number;
  lastPushedAt?: string;
  fileTree?: Record<string, unknown>;
  processingStatus?: 'pending' | 'completed' | 'failed';
  processingError?: string;
}

export interface GithubAccount {
  userId: string;
  githubUserId: number;
  login: string;
  avatarUrl?: string;
  htmlUrl?: string;
  connectedAt: string;
  updatedAt: string;
}

export interface GithubRepository {
  id: number;
  name: string;
  fullName: string;
  owner?: string;
  htmlUrl: string;
  description?: string | null;
  isPrivate: boolean;
  language?: string | null;
  stargazersCount?: number;
  updatedAt?: string;
}

export interface PublicProject {
  project: Project;
  author: User;
  itemCount: number;
}

export interface FunctionImplementation {
  platform: Platform;
  code: string;
  documentation: string;
}

// New Item interface (replaces EdgeFunction)
export interface Item {
  id: string;
  title: string;
  description: string;
  category: Category;
  type: ItemType;
  isVerified: boolean;
  author: User;
  createdAt: string;
  downloads: number;
  implementations: FunctionImplementation[];
  projectId?: string;
  project?: Project;
}

// Backward compatibility alias
export type EdgeFunction = Item;

export interface FilterState {
  query: string;
  platform: Platform | 'All';
  category: Category | 'All';
}

// Extended creator profile type for public profile pages
export interface CreatorProfile {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  websiteUrl?: string;
  links?: { label: string; url: string }[];
}


