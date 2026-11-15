export interface AnalysisContext {
  target_roles: string[];
  goals: string | null;
  additional_information: string | null;
}

export interface Profile {
  login: string;
  name: string | null;
  bio: string | null;
  followers: number;
  following: number;
}

export interface Repository {
  repo: string;
  default_branch: string;
  fork?: boolean;
}

export interface TechFile {
  repo: string;
  file_name: string;
  file_path: string;
  file_content: string;
}

export interface Workspace {
  username: string;
  profile: Profile | null;
  repositories: Repository[];
  tech: TechFile[];
  analysis: string;
  context: AnalysisContext;
  sample: boolean;
  createdAt: string;
  warnings: string[];
  repositoriesLoaded?: boolean;
  techLoaded?: boolean;
  evidenceId?: string;
  evidenceExpiresAt?: number;
}

export type View = 'landing' | 'overview' | 'repositories' | 'insights' | 'example' | 'saved';
