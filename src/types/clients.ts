
export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  birthDate?: string;
  birthTime?: string;
  birthLocation?: string;
  notes?: string;
  tags?: string[];
  reportsCount: number;
  lastActivity: string;
  createdAt: string;
  avatar?: string;
}

export interface ClientReport {
  id: string;
  clientId: string;
  title: string;
  type: string;
  createdAt: string;
  status: 'completed' | 'processing' | 'failed';
  content?: string;
}

export interface JournalEntry {
  id: string;
  clientId: string;
  content: string;
  tags: string[];
  linkedReportId?: string;
  createdAt: string;
  title?: string;
}

export interface ClientInsight {
  id: string;
  clientId: string;
  type: 'pattern' | 'recommendation' | 'warning' | 'opportunity';
  title: string;
  description: string;
  confidence: number;
  createdAt: string;
}
