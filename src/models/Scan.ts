export type ScanStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'canceled';

export interface ScanConfig {
  id: string;
  name: string;
  domainListId: string; 
  domainListName: string;
  startIndex: number;
  currentIndex: number;
  includeSubdomains: boolean;
  subdomains: string[];
  paths: string[];
  searchTerms: string[];
  // Performans ayarları
  concurrency?: number;
  timeout?: number;
  batchSize?: number;
  urlBatchSize?: number;
  retries?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScanResult {
  url: string;
  domain: string;
  path: string;
  subdomain?: string;
  searchTerms: string[];
  foundTerms: string[];
  statusCode: number;
  timestamp: Date;
}

export interface Scan {
  id: string;
  config: ScanConfig;
  status: ScanStatus;
  results: ScanResult[];
  startedAt: Date;
  pausedAt?: Date;
  completedAt?: Date;
  updatedAt: Date;
  progress: {
    totalDomains: number;
    scannedDomains: number;
    foundResults: number;
  };
} 