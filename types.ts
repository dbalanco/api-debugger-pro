import type { Dispatch, SetStateAction } from 'react';

// This is a dynamic import, so we only need the type
export type { GoogleGenAI } from '@google/genai';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | string;

export interface SecurityIssue {
  severity: 'high' | 'medium' | 'low';
  type: string;
  message: string;
  recommendation: string;
}

export interface ApiRequest {
  id: string; // Changed from number to string for UUID
  timestamp: Date;
  method: HttpMethod;
  url: string;
  status: number;
  duration: number;
  size: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  requestBody: unknown | null;
  responseBody: unknown | null;
  error: string | null;
  statusText?: string;
  securityIssues?: SecurityIssue[];
  aiInsight?: string;
}

export interface FilterOptions {
  method: string;
  status: string;
  url: string;
}

export interface RequestTemplate {
  url: string;
  method: HttpMethod;
  status: string;
  response: string;
}

export interface ApiDebuggerContextType {
  widgetEnabled: boolean;
  setWidgetEnabled: Dispatch<SetStateAction<boolean>>;
  debuggerEnabled: boolean;
  setDebuggerEnabled: Dispatch<SetStateAction<boolean>>;
  requests: ApiRequest[];
  setRequests: Dispatch<SetStateAction<ApiRequest[]>>;
  addRequest: (newRequest: Omit<ApiRequest, 'id' | 'timestamp' | 'securityIssues' | 'aiInsight'>) => void;
  replayRequest: (request: ApiRequest) => Promise<void>;
  clearAllRequests: () => Promise<void>;
  importRequests: (importedRequests: ApiRequest[]) => Promise<void>;
  updateRequest: (id: string, updates: Partial<ApiRequest>) => Promise<void>;
  isCollapsed: boolean;
  setIsCollapsed: Dispatch<SetStateAction<boolean>>;
  maxRequests: number;
  setMaxRequests: (value: number) => void;
  filters: FilterOptions;
  setFilters: Dispatch<SetStateAction<FilterOptions>>;
}
