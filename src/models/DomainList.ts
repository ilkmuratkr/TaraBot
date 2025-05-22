export interface Domain {
  id: string;
  domain: string;
  rank?: number;
}

export interface DomainList {
  id: string;
  name: string;
  source: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  domains: Domain[];
} 