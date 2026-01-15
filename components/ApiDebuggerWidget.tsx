import React, { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  ChevronDown, ChevronUp, X, Copy, Download, Search, Trash2, Globe,
  Clock, AlertCircle, BarChart3, Filter, Repeat, Settings, Shield,
  TrendingUp, Zap, Database, WifiOff, Activity, Monitor, RefreshCw,
  Maximize2, Minimize2, Terminal, Code, Network, Sparkles, BrainCircuit, Upload
} from 'lucide-react';
import { useApiDebugger } from '../contexts/ApiDebuggerContext';
import type { ApiRequest, FilterOptions, HttpMethod, SecurityIssue, GoogleGenAI } from '../types';
import { analyzeRequestSecurity } from '../utils/securityScanner';

// --- Environment Helper ---
const getApiKey = (): string | undefined => {
    try {
        // Vite support
        const meta = import.meta as any;
        if (typeof meta !== 'undefined' && meta.env && meta.env.VITE_API_KEY) {
            return meta.env.VITE_API_KEY;
        }
    } catch (e) {
        // Ignore errors accessing import.meta
    }
    // Fallback or Node support
    return process.env.API_KEY;
};

// --- AI Integration ---
const AI_MODEL_NAME = 'gemini-2.5-flash-preview-04-17';

let aiInstance: GoogleGenAI | null = null;
async function getAiClient(): Promise<GoogleGenAI> {
    if (aiInstance) {
        return aiInstance;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("AI client cannot be initialized. API_KEY is missing.");
    }
    
    try {
        const { GoogleGenAI } = await import('@google/genai');
        aiInstance = new GoogleGenAI({ apiKey });
        return aiInstance;
    } catch (e) {
        console.error("Failed to dynamically load or initialize GoogleGenAI", e);
        throw new Error("Failed to load AI module.");
    }
}


interface AiAnalysisProps {
  request: ApiRequest;
  updateRequest: (id: string, updates: Partial<ApiRequest>) => Promise<void>;
}

const emojiMap: Record<string, string> = {
    'Summary': '📝',
    'Positive': '✅',
    'Potential Considerations': '💡',
    'Actionable Items': '💡',
    'Performance': '⏱️',
    'Best Practice': '👍',
    'Response Body': '📦',
    'Robustness': '💪',
    'Security': '🛡️',
    'API Interaction Analysis': '🕵️‍♂️'
};

// Security Fix: Replaced dangerouslySetInnerHTML with safe React rendering
const AiInsightDisplay = memo(({ content }: { content: string }) => {
    const lines = useMemo(() => {
        // Simple Markdown-ish parser
        let cleanContent = content.replace(/```(markdown)?\s*\n?/g, '').replace(/```\s*$/g, '').trim();
        
        return cleanContent.split('\n').filter(line => line.trim() !== '').map((line, index) => {
             // Handle Code blocks within line
             const parts = line.split(/(`[^`]+`)/);
             const renderedParts = parts.map((part, i) => {
                 if (part.startsWith('`') && part.endsWith('`')) {
                     return <code key={i} className="text-purple-300 bg-gray-700 rounded px-1 py-0.5 font-mono text-xs">{part.slice(1, -1)}</code>;
                 }
                 return <span key={i}>{part}</span>;
             });

             // Headers
             const mainTitleMatch = line.match(/^\s*\*\*(API Interaction Analysis.*?)\*\*/);
             if (mainTitleMatch) {
                 return (
                    <h4 key={index} className="flex items-center text-sm font-semibold text-purple-300 mb-2">
                        {emojiMap['API Interaction Analysis']} <span className="ml-2">{mainTitleMatch[1].trim()}</span>
                    </h4>
                 );
             }

             // Bold lists
             const listItemMatch = line.match(/^\s*\*\s+\*\*(.*?):\*\*(.*)/);
             if (listItemMatch) {
                 const title = listItemMatch[1].trim();
                 const contentText = listItemMatch[2].trim();
                 const emoji = Object.entries(emojiMap).find(([key]) => title.startsWith(key))?.[1] || '➡️';

                 return (
                     <div key={index} className="mt-2">
                        <strong className="flex items-center text-xs font-semibold text-gray-200">
                            {emoji} <span className="ml-1.5">{title}</span>
                        </strong>
                        {contentText && <p className="text-xs text-gray-400 pl-5 mt-1">{contentText}</p>}
                     </div>
                 );
             }
            
             // Regular lists
             const continuationMatch = line.match(/^\s*\*\s+(.*)/);
             if (continuationMatch) {
                  return <p key={index} className="text-xs text-gray-400 pl-5">{continuationMatch[1].trim()}</p>;
             }

             return <p key={index} className="text-xs text-gray-400 mt-1">{renderedParts}</p>;
        });
    }, [content]);

    return (
        <div className="mt-2 p-3 text-xs bg-gray-800 border border-gray-700 rounded-md">
            {lines}
        </div>
    );
});


const AiAnalysis = memo(({ request, updateRequest }: AiAnalysisProps) => {
    const [error, setError] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const apiKey = getApiKey();

    const handleAnalyze = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsAnalyzing(true);
        setError(null);
        
        const prompt = `
            Analyze the following HTTP API interaction and provide a brief, actionable summary for a developer.
            Focus on potential issues, performance, and best practices.

            - Method: ${request.method}
            - URL: ${request.url}
            - Status: ${request.status}
            - Duration: ${request.duration}ms
            - Request Body: ${JSON.stringify(request.requestBody, null, 2)}
            - Response Body: ${JSON.stringify(request.responseBody, null, 2)}
            - Error: ${request.error || 'None'}

            Format your response in Markdown, using headings for different sections like Summary, Positive, and Potential Considerations.
            Start with a main title. For example:
            **API Interaction Analysis (POST /v1/products)**
            * **Summary:** A brief summary of the interaction.
            * **Positive:** What was done well.
            * **Potential Considerations/Actionable Items:**
            * **Performance:** Analysis of the request duration.
            * **Best Practice (Headers):** Recommendations for headers.
        `;

        try {
            const ai = await getAiClient();
            const response = await ai.models.generateContent({
                model: AI_MODEL_NAME,
                contents: prompt,
            });
            await updateRequest(request.id, { aiInsight: response.text });
        } catch (e: any) {
            console.error("AI analysis failed:", e);
            setError(e.message || "An unknown error occurred during analysis.");
        } finally {
            setIsAnalyzing(false);
        }

    }, [request, updateRequest]);

    const buttonText = isAnalyzing ? 'Analyzing...' : request.aiInsight ? 'Re-Analyze' : 'AI Analyze';

    return (
        <div className="mt-2">
            <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !apiKey}
                className="flex items-center justify-center space-x-2 w-full px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-all disabled:bg-purple-900 disabled:cursor-not-allowed"
            >
                {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                <span>{buttonText}</span>
            </button>
            {error && <div className="mt-2 p-2 text-xs text-red-300 bg-red-900/50 border border-red-700 rounded-md">{error}</div>}
            {!apiKey && <div className="mt-2 p-2 text-xs text-yellow-300 bg-yellow-900/50 border border-yellow-700 rounded-md">AI analysis disabled. API_KEY is not configured.</div>}
            {request.aiInsight && !isAnalyzing && (
                <AiInsightDisplay content={request.aiInsight} />
            )}
        </div>
    );
});


// UI Helper: StatusIndicator
interface StatusIndicatorProps {
  status: number;
}
const StatusIndicator = memo(({ status }: StatusIndicatorProps) => {
  const { colorClass, textClass } = useMemo(() => {
    if (!status || status === 0 || isNaN(status)) return { colorClass: 'bg-gray-500', textClass: 'text-gray-400' };
    if (status >= 200 && status < 300) return { colorClass: 'bg-green-500 shadow-[0_0_6px_#34d399]', textClass: 'text-green-400' };
    if (status >= 300 && status < 400) return { colorClass: 'bg-yellow-500 shadow-[0_0_6px_#fbbf24]', textClass: 'text-yellow-400' };
    if (status >= 400 && status < 500) return { colorClass: 'bg-red-500 shadow-[0_0_6px_#f87171]', textClass: 'text-red-400' };
    if (status >= 500) return { colorClass: 'bg-purple-500 shadow-[0_0_6px_#c084fc]', textClass: 'text-purple-400' };
    return { colorClass: 'bg-gray-500', textClass: 'text-gray-400' };
  }, [status]);

  return (
    <div className="flex items-center space-x-1.5">
      <div className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
      <span className={`text-sm font-medium ${textClass}`}>{status || 'ERR'}</span>
    </div>
  );
});

// UI Helper: MethodBadge
interface MethodBadgeProps {
  method: HttpMethod;
}
const MethodBadge = memo(({ method }: MethodBadgeProps) => {
  const colorClass = useMemo(() => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'bg-blue-200 text-blue-800';
      case 'POST': return 'bg-green-200 text-green-800';
      case 'PUT': return 'bg-yellow-200 text-yellow-800';
      case 'DELETE': return 'bg-red-200 text-red-800';
      case 'PATCH': return 'bg-purple-200 text-purple-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  }, [method]);

  return <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${colorClass}`}>{method}</span>;
});

// Panel: Analytics
const AnalyticsPanel = memo(() => {
  const { requests } = useApiDebugger();

  const analytics = useMemo(() => {
    if (requests.length === 0) return null;
    const totalRequests = requests.length;
    const errorRequests = requests.filter(r => r.status >= 400 || r.error).length;
    const errorRate = totalRequests > 0 ? ((errorRequests / totalRequests) * 100).toFixed(1) : '0.0';
    const durations = requests.map(r => r.duration).filter(d => d > 0);
    const averageResponseTime = durations.length > 0 ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0;
    const p95ResponseTime = durations.length > 0 ? [...durations].sort((a, b) => a - b)[Math.floor(durations.length * 0.95)] ?? 0 : 0;

    return {
      totalRequests,
      errorRate: parseFloat(errorRate),
      averageResponseTime,
      p95ResponseTime,
    };
  }, [requests]);

  if (!analytics) return (
    <div className="p-8 text-center text-gray-500 h-full flex flex-col justify-center items-center">
      <BarChart3 className="w-12 h-12 mx-auto mb-4" />
      <h3 className="text-lg font-medium mb-2 text-white">No Analytics Data</h3>
      <p>Make API requests to see analytics.</p>
    </div>
  );

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Total Requests" value={analytics.totalRequests} icon={<Database className="w-4 h-4" />} />
        <MetricCard label="Error Rate" value={`${analytics.errorRate}%`} valueColor={analytics.errorRate > 10 ? 'text-red-400' : 'text-green-400'} icon={<AlertCircle className="w-4 h-4" />} />
        <MetricCard label="Avg Response" value={`${analytics.averageResponseTime}ms`} valueColor={analytics.averageResponseTime > 1000 ? 'text-yellow-400' : 'text-green-400'} icon={<Clock className="w-4 h-4" />} />
        <MetricCard label="P95 Response" value={`${analytics.p95ResponseTime}ms`} valueColor={analytics.p95ResponseTime > 2000 ? 'text-red-400' : 'text-yellow-400'} icon={<TrendingUp className="w-4 h-4" />} />
      </div>
    </div>
  );
});

interface MetricCardProps { label: string; value: string | number; valueColor?: string; icon: React.ReactNode; }
const MetricCard = memo(({ label, value, valueColor = 'text-white', icon }: MetricCardProps) => (
  <div className="bg-gray-800 rounded-lg p-3 hover:bg-gray-700 transition-colors">
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs text-gray-400">{label}</span><span className="text-gray-500">{icon}</span>
    </div>
    <div className={`text-xl font-semibold ${valueColor}`}>{value}</div>
  </div>
));


// Panel: Settings
const SettingsPanel = memo(() => {
  const { maxRequests, setMaxRequests, requests, filters, setFilters, debuggerEnabled } = useApiDebugger();
  const apiKey = getApiKey();

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full text-white">
      <div>
        <h3 className="text-sm font-medium mb-2">Request Management</h3>
        <div className="flex items-center justify-between bg-gray-800 p-3 rounded-lg">
          <label htmlFor="max-requests" className="text-sm text-gray-300">Max Requests to Store</label>
          <input id="max-requests" type="number" min="10" max="1000" step="10" value={maxRequests} onChange={(e) => setMaxRequests(parseInt(e.target.value, 10) || 100)} className="w-24 px-2 py-1 text-sm bg-gray-900 border border-gray-600 rounded text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
        <p className="text-xs text-gray-500 mt-2">Higher values may impact performance. Current count: {requests.length}.</p>
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Live Filters</h3>
        <div className="space-y-2 bg-gray-800 p-3 rounded-lg">
          <input type="text" placeholder="Filter by method (e.g., GET)" value={filters.method} onChange={(e) => setFilters(prev => ({ ...prev, method: e.target.value.toUpperCase() }))} className="w-full px-3 py-1.5 text-sm bg-gray-900 border border-gray-600 rounded text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          <input type="text" placeholder="Filter by status code (e.g., 404)" value={filters.status} onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))} className="w-full px-3 py-1.5 text-sm bg-gray-900 border border-gray-600 rounded text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          <input type="text" placeholder="Filter by URL contains" value={filters.url} onChange={(e) => setFilters(prev => ({ ...prev, url: e.target.value }))} className="w-full px-3 py-1.5 text-sm bg-gray-900 border border-gray-600 rounded text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
      </div>
      <div className="pt-4 border-t border-gray-700">
        <h4 className="text-sm font-medium mb-2">Debug Information</h4>
        <div className="text-xs text-gray-400 space-y-1 font-mono bg-gray-800 p-3 rounded-lg">
          <div>Status: {debuggerEnabled ? <span className="text-green-400">Active</span> : <span className="text-red-400">Paused</span>}</div>
          <div>Memory: {requests.length}/{maxRequests} requests stored</div>
          <div>AI Ready: {apiKey ? <span className="text-green-400">Yes</span> : <span className="text-red-400">No (API Key missing)</span>}</div>
          <div>Version: v2.6.0</div>
        </div>
      </div>
    </div>
  );
});

// --- Security Panel ---
const SecurityPanel = memo(() => {
    const { requests } = useApiDebugger();
    const securityIssues = useMemo(() => {
        return requests
            .map(r => ({ request: r, issues: r.securityIssues || [] }))
            .filter(item => item.issues.length > 0);
    }, [requests]);

    if (securityIssues.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500 h-full flex flex-col justify-center items-center">
                <Shield className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <h3 className="text-lg font-medium mb-2 text-white">No Security Issues Found</h3>
                <p>The scanner hasn't detected any vulnerabilities.</p>
            </div>
        );
    }

    const severityClasses = {
        high: 'border-red-500 bg-red-900/30',
        medium: 'border-yellow-500 bg-yellow-900/30',
        low: 'border-blue-500 bg-blue-900/30',
    };

    return (
        <div className="p-2 space-y-2 overflow-y-auto h-full">
            {securityIssues.map(({ request, issues }) => (
                <div key={request.id} className="bg-gray-800 p-3 rounded-lg">
                    <div className="text-xs font-mono truncate text-gray-400 mb-2" title={request.url}>{request.method} {request.url}</div>
                    {issues.map((issue, index) => (
                        <div key={index} className={`p-2 rounded border-l-4 ${severityClasses[issue.severity]}`}>
                            <p className="font-semibold text-sm text-white">{issue.type}</p>
                            <p className="text-xs text-gray-300 mt-1">{issue.message}</p>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
});


// Panel: Requests
interface DetailSectionProps { title: string; data: unknown; copyToClipboard: (data: unknown) => void; }
const DetailSection = memo(({ title, data, copyToClipboard }: DetailSectionProps) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const content = useMemo(() => typeof data === 'string' ? data : JSON.stringify(data, null, 2), [data]);
    return (
        <div>
            <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-between text-xs text-blue-400 hover:text-blue-300 py-1">
                <span className="flex items-center space-x-1">{isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}<span>{title}</span></span>
                <Copy className="w-3 h-3" onClick={(e) => { e.stopPropagation(); copyToClipboard(data); }}/>
            </button>
            {isExpanded && <pre className="text-xs text-gray-300 overflow-x-auto bg-gray-800 rounded p-2 mt-1 max-h-32">{content}</pre>}
        </div>
    );
});

interface SecurityDetailsProps { issues: SecurityIssue[] }
const SecurityDetails = memo(({ issues }: SecurityDetailsProps) => {
    const severityClasses = {
        high: 'text-red-400 border-red-700 bg-red-900/50',
        medium: 'text-yellow-400 border-yellow-700 bg-yellow-900/50',
        low: 'text-blue-400 border-blue-700 bg-blue-900/50',
    };
    return (
        <div>
            <h4 className="text-xs text-yellow-300 mt-2 mb-1 font-semibold">Security Analysis</h4>
            {issues.map((issue, index) => (
                <div key={index} className={`p-2 rounded-md mb-1 ${severityClasses[issue.severity]}`}>
                    <p className="font-bold text-xs">[{issue.severity.toUpperCase()}] {issue.type}</p>
                    <p className="text-xs mt-1">{issue.message}</p>
                    <p className="text-xs mt-2 opacity-80 border-t border-current/20 pt-1">Recommendation: {issue.recommendation}</p>
                </div>
            ))}
        </div>
    )
});


interface RequestDetailsProps {
    request: ApiRequest;
    copyToClipboard: (data: unknown) => void;
    updateRequest: (id: string, updates: Partial<ApiRequest>) => Promise<void>;
}
const RequestDetails = memo(({ request, copyToClipboard, updateRequest }: RequestDetailsProps) => (
  <div className="mt-3 space-y-2 border-t border-gray-600 pt-3">
    {Object.keys(request.requestHeaders).length > 0 && <DetailSection title="Request Headers" data={request.requestHeaders} copyToClipboard={copyToClipboard} />}
    {request.requestBody && <DetailSection title="Request Body" data={request.requestBody} copyToClipboard={copyToClipboard} />}
    {Object.keys(request.responseHeaders).length > 0 && <DetailSection title="Response Headers" data={request.responseHeaders} copyToClipboard={copyToClipboard} />}
    {request.responseBody && <DetailSection title="Response Body" data={request.responseBody} copyToClipboard={copyToClipboard} />}
    {request.error && (
      <div className="bg-red-900/50 border border-red-700 rounded p-2"><div className="flex items-center space-x-1 text-xs text-red-400 mb-1"><AlertCircle className="w-3 h-3" /><span>Error</span></div><pre className="text-xs text-red-300 overflow-x-auto">{request.error}</pre></div>
    )}
    {request.securityIssues && request.securityIssues.length > 0 && <SecurityDetails issues={request.securityIssues} />}
    <AiAnalysis request={request} updateRequest={updateRequest} />
  </div>
));

interface RequestCardProps {
    request: ApiRequest;
    isSelected: boolean;
    onSelect: () => void;
    onReplay: () => Promise<void>;
    copyToClipboard: (data: unknown) => void;
    updateRequest: (id: string, updates: Partial<ApiRequest>) => Promise<void>;
}
const RequestCard = memo(({ request, isSelected, onSelect, onReplay, copyToClipboard, updateRequest }: RequestCardProps) => {
  const [isReplaying, setIsReplaying] = useState(false);
  const hasSecurityIssues = request.securityIssues && request.securityIssues.length > 0;

  const handleReplayClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsReplaying(true);
    await onReplay();
    setIsReplaying(false);
  }, [onReplay]);

  return (
    <div onClick={onSelect} className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${isSelected ? 'bg-blue-900/50 border border-blue-600 shadow-lg' : 'bg-gray-800 hover:bg-gray-700 border border-transparent'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2"><StatusIndicator status={request.status} /><MethodBadge method={request.method} /></div>
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          {hasSecurityIssues && <span title="Security issues found"><Shield className="w-3 h-3 text-yellow-400" /></span>}
          <span className={request.duration > 1000 ? 'text-red-400' : request.duration > 500 ? 'text-yellow-400' : 'text-green-400'}>{request.duration}ms</span>
          <span>{request.size > 1024 ? `${(request.size / 1024).toFixed(1)}KB` : `${request.size}B`}</span>
           <button onClick={handleReplayClick} disabled={isReplaying} className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-wait" title="Replay Request">
             {isReplaying ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Repeat className="w-3 h-3" />}
           </button>
        </div>
      </div>
      <div className="text-sm text-gray-300 truncate font-mono">{request.url}</div>
      {isSelected && <RequestDetails request={request} copyToClipboard={copyToClipboard} updateRequest={updateRequest} />}
    </div>
  );
});

const RequestsPanel = memo(() => {
  const { requests, importRequests, clearAllRequests, replayRequest, debuggerEnabled, filters, updateRequest } = useApiDebugger();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = useCallback(async (data: unknown) => {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(text);
  }, []);

  const handleReplay = useCallback(async (request: ApiRequest) => {
    await replayRequest(request);
  }, [replayRequest]);

  const exportRequests = useCallback((format: 'json' | 'har' = 'json') => {
    const isHar = format === 'har';
    const dataStr = isHar ? JSON.stringify(exportToHar(requests), null, 2) : JSON.stringify(requests, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `api-requests-${timestamp}.${isHar ? 'har' : 'json'}`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [requests]);

  const handleClear = useCallback(async () => {
    if (window.confirm('Are you sure you want to clear all requests? This will also clear persisted data.')) {
        await clearAllRequests();
        setSelectedRequestId(null);
    }
  }, [clearAllRequests]);
  
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const content = e.target?.result as string;
            if (!content) throw new Error("File is empty.");
            const data = JSON.parse(content);
            let importedRequests: ApiRequest[] = [];

            if (data.log && Array.isArray(data.log.entries)) { // HAR format
                importedRequests = data.log.entries.map(mapHarEntryToApiRequest).filter(Boolean).map(r => ({...r!, securityIssues: analyzeRequestSecurity(r!)})) as ApiRequest[];
            } else if (Array.isArray(data) && data[0]?.method && data[0]?.url) { // Proprietary JSON format
                importedRequests = data.map(req => ({...req, timestamp: new Date(req.timestamp), securityIssues: analyzeRequestSecurity(req)}));
            } else {
                throw new Error("Unrecognized or invalid file format.");
            }
            
            await importRequests(importedRequests);
            alert(`Successfully imported ${importedRequests.length} requests.`);
        } catch (err: any) {
            console.error("Failed to import file:", err);
            alert(`Import failed: ${err.message}`);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    reader.readAsText(file);
  };

  const filteredRequests = useMemo(() => requests.filter(req => 
    (req.url.toLowerCase().includes(searchTerm.toLowerCase()) || req.method.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (!filters.method || req.method.toUpperCase().includes(filters.method)) &&
    (!filters.status || req.status.toString().includes(filters.status)) &&
    (!filters.url || req.url.toLowerCase().includes(filters.url.toLowerCase()))
  ), [requests, searchTerm, filters]);

  // Infinite Scroll Handler
  const handleScroll = useCallback(() => {
    if (listContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = listContainerRef.current;
        // Load more when user is near bottom (50px buffer)
        if (scrollTop + clientHeight >= scrollHeight - 50) {
            setVisibleCount(prev => {
                if (prev >= filteredRequests.length) return prev;
                return prev + 20;
            });
        }
    }
  }, [filteredRequests.length]);

  return (
    <div className="h-full flex flex-col">
      <div className={`p-3 border-b border-gray-700 ${!debuggerEnabled ? 'opacity-50' : ''}`}>
        <div className="flex items-center space-x-2 mb-2">
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" id="api-debugger-search-input" placeholder="Search URLs or methods... (⌘K)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-gray-800 border-gray-600 border rounded-md px-8 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={!debuggerEnabled} />
                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>}
            </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json,.har" style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={!debuggerEnabled} className="flex-1 flex items-center justify-center space-x-1.5 px-2 py-1.5 text-xs rounded-md border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed" title="Import from JSON or HAR"><Upload className="w-3 h-3" /><span>Import</span></button>
            <button onClick={() => exportRequests('json')} disabled={!debuggerEnabled || requests.length === 0} className="flex-1 flex items-center justify-center space-x-1.5 px-2 py-1.5 text-xs rounded-md border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed" title="Export as JSON"><span>Export JSON</span></button>
            <button onClick={() => exportRequests('har')} disabled={!debuggerEnabled || requests.length === 0} className="flex-1 flex items-center justify-center space-x-1.5 px-2 py-1.5 text-xs rounded-md border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed" title="Export as HAR"><span>Export HAR</span></button>
            <button onClick={handleClear} disabled={!debuggerEnabled || requests.length === 0} className="p-2 rounded-md border border-gray-600 text-gray-400 hover:text-red-400 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed" title="Clear all requests (⌘⇧K)"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      <div 
        className="overflow-y-auto flex-1 p-2 space-y-1.5 h-full" 
        ref={listContainerRef} 
        onScroll={handleScroll}
      >
        {filteredRequests.length > 0 ? (
          filteredRequests.slice(0, visibleCount).map(request => (
            <RequestCard key={request.id} request={request} isSelected={selectedRequestId === request.id} onSelect={() => setSelectedRequestId(s => s === request.id ? null : request.id)} onReplay={() => handleReplay(request)} copyToClipboard={copyToClipboard} updateRequest={updateRequest} />
          ))
        ) : (
          <div className="p-4 text-center text-gray-500 h-full flex flex-col justify-center items-center">
            {requests.length > 0 ? <><Search className="w-8 h-8 mx-auto mb-2" /><div>No requests match filter</div></> : debuggerEnabled ? <><Database className="w-8 h-8 mx-auto mb-2" /><div>No requests captured yet</div></> : <><WifiOff className="w-8 h-8 mx-auto mb-2" /><div>Debugger is paused</div></>}
          </div>
        )}
      </div>
    </div>
  );
});

// --- Import/Export Helpers ---
function mapHarEntryToApiRequest(entry: any): ApiRequest | null {
    if (!entry?.request?.method || !entry?.request?.url || !entry?.response?.status) {
        return null; // Skip invalid entries
    }

    let requestBody: unknown = null;
    if (entry.request.postData?.text) {
        try { requestBody = JSON.parse(entry.request.postData.text); }
        catch { requestBody = entry.request.postData.text; }
    }
    
    let responseBody: unknown = null;
    if (entry.response.content?.text) {
        try { responseBody = JSON.parse(entry.response.content.text); }
        catch { responseBody = entry.response.content.text; }
    }

    const headersToRecord = (headers: {name: string, value: string}[]) => 
        (headers || []).reduce((acc: Record<string, string>, h) => {
            acc[h.name.toLowerCase()] = h.value;
            return acc;
        }, {});

    const request: Omit<ApiRequest, 'id' | 'securityIssues' | 'aiInsight'> = {
        timestamp: new Date(entry.startedDateTime),
        method: entry.request.method,
        url: entry.request.url,
        status: entry.response.status,
        duration: entry.time || 0,
        size: entry.response.content?.size || 0,
        requestHeaders: headersToRecord(entry.request.headers),
        responseHeaders: headersToRecord(entry.response.headers),
        requestBody: requestBody,
        responseBody: responseBody,
        error: entry.response.status >= 400 ? entry.response.statusText : null,
        statusText: entry.response.statusText,
    };

    return {
        ...request,
        id: crypto.randomUUID(), // Use UUID
    };
}

function exportToHar(requests: ApiRequest[]) {
  return {
    log: {
      version: "1.2",
      creator: { name: "API Debugger Pro", version: "2.6.0" },
      browser: { name: "API Debugger Pro", version: "2.6.0" },
      entries: requests.map(req => {
        const requestBodyStr = req.requestBody ? JSON.stringify(req.requestBody, null, 2) : "";
        const responseBodyStr = req.responseBody ? JSON.stringify(req.responseBody, null, 2) : "";

        const recordToHeaders = (record: Record<string, string>) => Object.entries(record).map(([name, value]) => ({ name, value }));

        return {
          startedDateTime: req.timestamp.toISOString(),
          time: req.duration,
          request: {
            method: req.method,
            url: req.url,
            httpVersion: "HTTP/1.1",
            cookies: [],
            headers: recordToHeaders(req.requestHeaders),
            queryString: [],
            postData: req.requestBody ? {
              mimeType: req.requestHeaders['Content-Type'] || req.requestHeaders['content-type'] || 'application/json',
              text: requestBodyStr,
            } : undefined,
            headersSize: -1,
            bodySize: new Blob([requestBodyStr]).size,
          },
          response: {
            status: req.status,
            statusText: req.statusText || "",
            httpVersion: "HTTP/1.1",
            cookies: [],
            headers: recordToHeaders(req.responseHeaders),
            content: {
              size: req.size,
              mimeType: req.responseHeaders['content-type'] || 'application/json',
              text: responseBodyStr,
            },
            redirectURL: "",
            headersSize: -1,
            bodySize: req.size,
          },
          cache: {},
          timings: { send: 0, wait: req.duration, receive: 0 },
        };
      }).reverse(), // HAR spec often has entries in chronological order
    },
  };
}


// Main Widget Component
export const ApiDebuggerWidget = memo(() => {
  const { widgetEnabled, debuggerEnabled, setWidgetEnabled, requests, isCollapsed, setIsCollapsed, clearAllRequests } = useApiDebugger();
  const [activeTab, setActiveTab] = useState('requests');
  const securityIssuesCount = useMemo(() => requests.reduce((acc, r) => acc + (r.securityIssues?.length || 0), 0), [requests]);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isModifier = isMac ? event.metaKey : event.ctrlKey;

      if (!isModifier) return;

      switch (event.key.toLowerCase()) {
        case '.':
          event.preventDefault();
          setIsCollapsed(prev => !prev);
          break;
        case 'k':
          event.preventDefault();
          if (event.shiftKey) {
            // Cmd/Ctrl + Shift + K -> Clear all
            if (requests.length > 0 && window.confirm('Are you sure you want to clear all requests? This will also clear persisted data.')) {
              clearAllRequests();
            }
          } else {
            // Cmd/Ctrl + K -> Focus search
            setIsCollapsed(false);
            setActiveTab('requests');
            // Use a timeout to ensure the panel is rendered before focusing
            setTimeout(() => {
              const searchInput = document.getElementById('api-debugger-search-input');
              searchInput?.focus();
            }, 50);
          }
          break;
        case '1':
          event.preventDefault();
          setIsCollapsed(false);
          setActiveTab('requests');
          break;
        case '2':
          event.preventDefault();
          if (requests.length > 0) {
            setIsCollapsed(false);
            setActiveTab('security');
          }
          break;
        case '3':
          event.preventDefault();
          if (requests.length > 0) {
            setIsCollapsed(false);
            setActiveTab('analytics');
          }
          break;
        case '4':
          event.preventDefault();
          setIsCollapsed(false);
          setActiveTab('settings');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setIsCollapsed, setActiveTab, clearAllRequests, requests.length]);

  if (!widgetEnabled) return null;

  if (isCollapsed) {
    return (
      <div onClick={() => setIsCollapsed(false)} className="fixed bottom-4 right-4 z-[99999] cursor-pointer group" title="Toggle Widget (⌘.)">
        <div className="border border-gray-700 bg-gray-900 hover:bg-gray-800 rounded-full p-3 shadow-2xl transition-all duration-300 flex items-center space-x-2">
          <Terminal className={`w-5 h-5 ${debuggerEnabled ? 'text-blue-400' : 'text-gray-500'}`} />
          <div className={`w-2 h-2 rounded-full ${debuggerEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
          {requests.length > 0 && debuggerEnabled && <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{requests.length}</div>}
          {securityIssuesCount > 0 && <div className="absolute -top-1 -left-1 bg-yellow-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"><Shield size={12} /></div>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[99999]">
      <div className="border border-gray-700 rounded-lg shadow-2xl bg-gray-900/80 backdrop-blur-md text-white flex flex-col w-[min(500px,calc(100vw-2rem))] h-[min(700px,calc(100vh-6rem))]">
        <header className="flex items-center justify-between p-3 border-b border-gray-700">
          <div className="flex items-center space-x-2"><Terminal className={`w-5 h-5 ${debuggerEnabled ? 'text-blue-400' : 'text-gray-500'}`} /><span className="font-medium">API Debugger</span></div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setWidgetEnabled(false)} className={`w-10 h-5 rounded-full transition-colors bg-green-500`} title="Hide Widget"><div className={`w-4 h-4 rounded-full bg-white transition-transform transform translate-x-5`} /></button>
            <button onClick={() => setIsCollapsed(true)} className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded" title="Minimize (⌘.)"><Minimize2 className="w-4 h-4" /></button>
          </div>
        </header>
        <nav className="flex flex-wrap border-b border-gray-700">
          {[
            { id: 'requests', label: 'Requests', icon: <Database className="w-4 h-4" />, shortcut: '1' },
            { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" />, count: securityIssuesCount, shortcut: '2' },
            { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" />, shortcut: '3' },
            { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, shortcut: '4' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} disabled={(tab.id === 'analytics' || tab.id === 'security') && requests.length === 0} className={`flex-grow px-4 py-2 text-sm transition-colors relative ${activeTab === tab.id ? 'bg-blue-900/50 text-blue-300 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'} disabled:opacity-50 disabled:cursor-not-allowed`} title={`${tab.label} (⌘${tab.shortcut})`}>
              <div className="flex items-center justify-center space-x-1.5">{tab.icon}<span>{tab.label}</span></div>
              {tab.count && tab.count > 0 && <span className="absolute top-1 right-1 bg-yellow-500 text-black text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">{tab.count}</span>}
            </button>
          ))}
        </nav>
        <main className="flex-1 overflow-hidden">
          {activeTab === 'requests' && <RequestsPanel />}
          {activeTab === 'security' && <SecurityPanel />}
          {activeTab === 'analytics' && <AnalyticsPanel />}
          {activeTab === 'settings' && <SettingsPanel />}
        </main>
      </div>
    </div>
  );
});
