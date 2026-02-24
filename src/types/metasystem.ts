export interface MetasystemEvent {
  id: string;
  timestamp: string;
  source: 'github' | 'agent' | 'system' | 'manual';
  type: string;
  payload: Record<string, any>;
}

export interface GitHubWebhookPayload {
  action?: string;
  repository?: {
    full_name: string;
    html_url: string;
  };
  sender?: {
    login: string;
  };
  // Add other fields as needed (ref, commits, etc.)
  [key: string]: any;
}
