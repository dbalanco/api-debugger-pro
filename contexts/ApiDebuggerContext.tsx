import React, { useState, useEffect, useMemo, createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { ApiRequest, ApiDebuggerContextType, FilterOptions } from '../types';
import { initDB, addRequestToDb, getAllRequestsFromDb, clearDb, trimDb } from '../utils/db';
import { analyzeRequestSecurity } from '../utils/securityScanner';
import { maskSensitiveData } from '../utils/masking';

const ApiDebuggerContext = createContext<ApiDebuggerContextType | undefined>(undefined);

interface ApiDebuggerProviderProps {
  children: ReactNode;
  initialMaxRequests?: number;
}

/**
 * Robust UUID Generator
 * Prioritizes crypto.randomUUID, falls back to crypto.getRandomValues, and finally Math.random.
 */
function generateUUID(): string {
    if (typeof crypto !== 'undefined') {
        if (crypto.randomUUID) {
            return crypto.randomUUID();
        }
        if (crypto.getRandomValues) {
            // Stronger fallback using getRandomValues for older environments
            return ((1e7 as any).toString() + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: any) =>
                (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            );
        }
    }
    // Fallback for insecure contexts (http) where crypto might be restricted
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Robust check for Private IPs (IPv4 and IPv6)
 */
function isPrivateNetwork(urlStr: string): boolean {
    try {
        const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        const hostname = new URL(urlStr, base).hostname;
        
        // IPv4 regex (Localhost, 127.x.x.x, 10.x.x.x, 172.16-31.x.x, 192.168.x.x)
        const ipv4Private = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/;
        if (ipv4Private.test(hostname)) return true;

        // IPv6 regex
        const cleanHost = hostname.replace(/^\[|\]$/g, '');
        if (cleanHost === '::1') return true;
        if (cleanHost.toLowerCase().startsWith('fc')) return true;
        if (cleanHost.toLowerCase().startsWith('fd')) return true;
        if (cleanHost.toLowerCase().startsWith('fe80')) return true;

        return false;
    } catch {
        return false;
    }
}

export const ApiDebuggerProvider: React.FC<ApiDebuggerProviderProps> = ({ children, initialMaxRequests = 100 }) => {
  const [widgetEnabled, setWidgetEnabled] = useState(true);
  const [debuggerEnabled, setDebuggerEnabled] = useState(true);
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [maxRequests, setMaxRequestsState] = useState(initialMaxRequests);
  const [isDbInitialized, setIsDbInitialized] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    method: '',
    status: '',
    url: ''
  });
  
  useEffect(() => {
    const initialize = async () => {
        try {
            await initDB();
            const storedRequests = await getAllRequestsFromDb();
            setRequests(storedRequests.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
            setIsDbInitialized(true);
        } catch (e) {
            console.error("Failed to initialize DB:", e);
        }
    };
    initialize();
  }, []);

  const setMaxRequests = useCallback(async (value: number) => {
    const newMax = Math.min(Math.max(value, 10), 1000);
    setMaxRequestsState(newMax);
    if (isDbInitialized) {
        await trimDb(newMax);
        const currentRequests = await getAllRequestsFromDb();
        setRequests(currentRequests.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
    }
  }, [isDbInitialized]);

  const addRequest = useCallback(async (requestData: Omit<ApiRequest, 'id' | 'timestamp' | 'securityIssues' | 'aiInsight'>) => {
    if (!isDbInitialized) return;
    
    const id = generateUUID();
    
    const rawRequest: ApiRequest = {
        ...requestData,
        id,
        timestamp: new Date(),
        securityIssues: []
    };
    
    try {
        rawRequest.securityIssues = analyzeRequestSecurity(rawRequest);
    } catch (e) {
        console.warn('Security analysis failed for request:', e);
    }

    const safeRequest = maskSensitiveData(rawRequest);

    await addRequestToDb(safeRequest);
    await trimDb(maxRequests);
    
    setRequests(prev => [safeRequest, ...prev].slice(0, maxRequests));
  }, [maxRequests, isDbInitialized]);
  
  const updateRequest = useCallback(async (id: string, updates: Partial<ApiRequest>) => {
    let updatedRequest: ApiRequest | undefined;
    setRequests(prev => prev.map(r => {
      if (r.id === id) {
        updatedRequest = { ...r, ...updates };
        return updatedRequest;
      }
      return r;
    }));

    if (updatedRequest) {
      const safeToSave = maskSensitiveData(updatedRequest);
      await addRequestToDb(safeToSave); 
    }
  }, []);

  const replayRequest = useCallback(async (requestToReplay: ApiRequest): Promise<void> => {
    try {
        if (isPrivateNetwork(requestToReplay.url)) {
            const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
            const targetHostname = new URL(requestToReplay.url, base).hostname;
            const currentHostname = window.location.hostname;
            
            if (targetHostname !== currentHostname) {
                const confirmed = window.confirm(
                    `SECURITY WARNING: You are attempting to replay a request to a private network resource (${targetHostname}).\n\n` +
                    `If this request log was imported from an external source, this could be a malicious attempt to access your local network.\n\n` +
                    `Do you want to proceed?`
                );
                if (!confirmed) return;
            }
        }
    } catch (e) {
        // Continue if check fails
    }

    const startTime = Date.now();
    let status = 0;
    let statusText = '';
    let responseBody: unknown = null;
    let responseHeaders: Record<string, string> = {};
    let error: string | null = null;
    let size = 0;

    try {
        const response = await fetch(requestToReplay.url, {
            method: requestToReplay.method,
            headers: requestToReplay.requestHeaders as HeadersInit,
            body: requestToReplay.requestBody ? JSON.stringify(requestToReplay.requestBody) : null,
            mode: 'cors',
        });

        status = response.status;
        statusText = response.statusText;

        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        const textBody = await response.text();
        size = new Blob([textBody]).size;

        try {
            responseBody = JSON.parse(textBody);
        } catch {
            responseBody = textBody;
        }

        if (!response.ok) {
          error = `Replay failed with status ${status}`;
        }

    } catch (e: any) {
        status = 0;
        statusText = 'Network Error';
        error = e.message || 'Network request failed during replay';
        responseBody = { error: e.toString() };
    }

    const duration = Date.now() - startTime;
    
    await addRequest({
        method: requestToReplay.method,
        url: requestToReplay.url,
        status,
        duration,
        size,
        requestHeaders: requestToReplay.requestHeaders,
        responseHeaders,
        requestBody: requestToReplay.requestBody,
        responseBody,
        error,
        statusText,
    });
}, [addRequest]);
  
  const clearAllRequests = useCallback(async () => {
    await clearDb();
    setRequests([]);
  }, []);

  const importRequests = useCallback(async (importedRequests: ApiRequest[]) => {
      for (const req of importedRequests) {
          const safeReq = maskSensitiveData(req);
          await addRequestToDb(safeReq);
      }
      const allRequests = await getAllRequestsFromDb();
      setRequests(allRequests.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
  }, []);

  useEffect(() => {
    if (!debuggerEnabled && widgetEnabled) {
      setWidgetEnabled(false);
    }
  }, [debuggerEnabled, widgetEnabled]);
  
  const value = useMemo(() => ({
    widgetEnabled,
    setWidgetEnabled,
    debuggerEnabled,
    setDebuggerEnabled,
    requests,
    setRequests,
    addRequest,
    replayRequest,
    clearAllRequests,
    importRequests,
    updateRequest,
    isCollapsed,
    setIsCollapsed,
    maxRequests,
    setMaxRequests,
    filters,
    setFilters
  }), [
    widgetEnabled, debuggerEnabled, requests, isCollapsed,
    maxRequests, filters, addRequest, replayRequest, setMaxRequests, clearAllRequests, importRequests, updateRequest
  ]);

  return (
    <ApiDebuggerContext.Provider value={value}>
      {children}
    </ApiDebuggerContext.Provider>
  );
};

export const useApiDebugger = (): ApiDebuggerContextType => {
  const context = useContext(ApiDebuggerContext);
  if (context === undefined) {
    throw new Error('useApiDebugger must be used within an ApiDebuggerProvider');
  }
  return context;
};
