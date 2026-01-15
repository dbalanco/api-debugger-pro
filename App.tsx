import React, { memo, useCallback, useMemo, useState, ErrorInfo, ReactNode, useEffect } from 'react';
import { ApiDebuggerProvider, useApiDebugger } from './contexts/ApiDebuggerContext';
import { ApiDebuggerWidget } from './components/ApiDebuggerWidget';
import type { ApiRequest, HttpMethod, RequestTemplate } from './types';
import { maskUrl, maskString } from './utils/masking';
import {
  Zap, Database, AlertCircle, Shield, Clock, BarChart3, Trash2, Download, CheckCircle, XCircle, Settings, Code, Monitor, PlayCircle, Globe, Check, X, Film
} from 'lucide-react';

// --- Error Boundary ---
interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    public state: ErrorBoundaryState = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="w-full h-screen flex flex-col justify-center items-center bg-red-50 text-red-800 p-4">
                    <div className="text-center">
                        <XCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                        <h1 className="text-2xl font-bold mb-2">Something went wrong.</h1>
                        <p className="mb-4">An unexpected error has occurred. Please try again.</p>
                        {this.state.error && (
                             <pre className="bg-red-100 text-left text-sm p-4 rounded-md overflow-auto max-w-lg mb-4">
                                {this.state.error?.toString()}
                            </pre>
                        )}
                        <button
                            onClick={() => this.setState({ hasError: false, error: undefined })}
                            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                            Try again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}


// --- Reusable UI Components ---

const MethodBadge = memo(({ method }: { method: string }) => {
  const colors = useMemo(() => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'bg-blue-100 text-blue-800';
      case 'POST':return 'bg-green-100 text-green-800';
      case 'PUT': return 'bg-yellow-100 text-yellow-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      case 'PATCH': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }, [method]);
  return <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${colors}`}>{method}</span>;
});

const StatusIndicator = memo(({ status }: { status: number }) => {
    const { dotClass, textColor } = useMemo(() => {
        if (!status || status < 100) return { dotClass: 'bg-gray-400', textColor: 'text-gray-500' };
        if (status < 300) return { dotClass: 'bg-green-500 shadow-[0_0_6px_#16a34a]', textColor: 'text-green-600' };
        if (status < 400) return { dotClass: 'bg-yellow-500 shadow-[0_0_6px_#d97706]', textColor: 'text-yellow-600' };
        if (status < 600) return { dotClass: 'bg-red-500 shadow-[0_0_6px_#dc2626]', textColor: 'text-red-600' };
        return { dotClass: 'bg-gray-400', textColor: 'text-gray-500' };
    }, [status]);

    return (
        <div className="flex items-center space-x-2">
            <div className={`w-2.5 h-2.5 rounded-full ${dotClass}`} />
            <span className={`text-xs font-bold ${textColor}`}>{status || 'N/A'}</span>
        </div>
    );
});


const SwitchToggle = memo(({label, enabled, onChange, disabled = false}: {label: string, enabled: boolean, onChange: (enabled: boolean) => void, disabled?: boolean}) => (
    <div className="flex items-center space-x-2">
        <span className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>{label}</span>
        <button
            onClick={() => onChange(!enabled)}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-200'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
    </div>
));

const StatCard = memo(({icon, label, value}: {icon: React.ReactNode, label: string, value: string}) => (
    <div className="bg-gray-50 rounded-lg p-4 transition-all hover:bg-white hover:shadow-md">
        <div className="flex items-center">
            {icon}
            <span className="ml-2 text-sm font-medium text-gray-500">{label}</span>
        </div>
        <p className="text-2xl font-semibold text-gray-900 mt-2">{value}</p>
    </div>
));

const DebugStatus = memo(() => {
    const { widgetEnabled, debuggerEnabled, requests } = useApiDebugger();
    const latestRequest = requests.length > 0 ? requests[0] : null;

    const StatusDisplayLine = ({
        label,
        active,
        activeText,
        inactiveText,
        inactiveStyle = 'cross'
    }: {label: string, active: boolean, activeText: string, inactiveText: string, inactiveStyle?: 'circle' | 'cross'}) => {
        return (
            <div className="flex items-center">
                <span className="text-gray-800 w-28 flex-shrink-0">{label}:</span>
                {active ? (
                    <span className="flex items-center font-medium text-green-700">
                         <div className="flex items-center justify-center w-[18px] h-[18px] mr-2 bg-green-500 rounded-sm">
                            <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                         </div>
                         {activeText}
                    </span>
                ) : (
                    <span className="flex items-center font-medium text-gray-700">
                        {inactiveStyle === 'circle' ? (
                            <div className="w-5 h-5 mr-2 flex items-center justify-center">
                                <div className="w-3.5 h-3.5 border-2 border-red-500 rounded-full" />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center w-[18px] h-[18px] mr-2 bg-red-500 rounded-sm">
                                <X className="w-4 h-4 text-white" strokeWidth={3}/>
                             </div>
                        )}
                        {inactiveText}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Column 1: Current Status */}
                 <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm md:col-span-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Status</h3>
                    <div className="space-y-3 text-sm">
                        <StatusDisplayLine label="Monitoring" active={debuggerEnabled} activeText="Active" inactiveText="Paused" />
                        <StatusDisplayLine label="Widget" active={widgetEnabled} activeText="Enabled" inactiveText="Disabled" />

                        <div className="flex items-center">
                             <span className="text-gray-800 w-28 flex-shrink-0">Requests:</span>
                             <span className="font-semibold text-blue-600">
                                {requests.length} captured
                             </span>
                        </div>
                    </div>
                </div>
                
                {/* Column 2: Latest Request */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm md:col-span-2">
                     <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest Request</h3>
                     {latestRequest ? (
                         <div className="text-sm text-gray-700 space-y-2">
                             <div className="flex items-center font-medium">
                                 <Globe className="w-4 h-4 mr-2 text-slate-800 flex-shrink-0"/>
                                 <span>
                                     <span className="font-bold text-gray-900">Regular API</span>
                                     <span className="text-slate-400 mx-1.5">•</span>
                                     Status: {latestRequest.status}
                                     <span className="text-slate-400 mx-1.5">•</span>
                                     Method: {latestRequest.method}
                                 </span>
                             </div>
                              <div className="flex items-center">
                                 <Clock className="w-4 h-4 mr-2 text-slate-600 flex-shrink-0" />
                                 <span>Time: {latestRequest.timestamp.toLocaleTimeString()}</span>
                              </div>
                              <div className="flex items-center">
                                <BarChart3 className="w-4 h-4 mr-2 text-slate-600 flex-shrink-0" />
                                 <span>Duration: {latestRequest.duration}ms</span>
                             </div>
                         </div>
                     ) : (
                         <div className="flex items-center text-sm text-gray-500 h-full">
                            <p>No requests captured yet.</p>
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
});


// --- Main Dashboard Components ---

const LiveApiTable = memo(() => {
  const { requests, debuggerEnabled } = useApiDebugger();

  // Show only latest 5 for performance and to keep the UI clean
  const filteredRequests = useMemo(() => requests.slice(0, 5), [requests]);

  const getEndpoint = useCallback((url: string): string => {
    try {
      return new URL(url).pathname;
    } catch {
      return url; // fallback for invalid urls
    }
  }, []);

  const formatSize = useCallback((bytes: number): string => {
    if (!bytes || bytes === 0) return '-';
    return `${bytes}B`;
  }, []);

  if (!debuggerEnabled) {
    return null;
  }
  
  return (
    <section className="bg-white rounded-xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Monitor className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-semibold text-gray-800">Live API Monitor</h2>
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-green-600">Live</span>
          </div>
        </div>
        {requests.length > 0 && (
          <div className="bg-blue-100 text-blue-800 text-xs font-semibold rounded-full px-2.5 py-1">
            {requests.length} total
          </div>
        )}
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Real-time API monitoring with intelligent status indicators and performance metrics
      </p>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                {['Time', 'Method', 'Status', 'Endpoint', 'Duration', 'Size'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-500">No API requests captured yet</td></tr>
              ) : (
                filteredRequests.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{req.timestamp.toLocaleTimeString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><MethodBadge method={req.method} /></td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusIndicator status={req.status} /></td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono truncate max-w-xs" title={req.url}>{getEndpoint(req.url)}</td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${
                        req.duration > 1000 ? 'text-red-500' : req.duration > 500 ? 'text-yellow-600' : 'text-green-600'
                    }`}>{req.duration}ms</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatSize(req.size)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
       {requests.length > filteredRequests.length && (
          <p className="text-xs text-center text-gray-500 mt-3">
              Showing latest {filteredRequests.length} of {requests.length} requests.
          </p>
      )}
    </section>
  );
});

const ApiDebuggerDashboard = memo(() => {
    const { requests, clearAllRequests, widgetEnabled, setWidgetEnabled, debuggerEnabled, setDebuggerEnabled } = useApiDebugger();

    const stats = useMemo(() => {
        const total = requests.length;
        const errors = requests.filter(r => r.status >= 400 || r.error).length;
        const successRate = total > 0 ? (((total - errors) / total) * 100).toFixed(1) : '0.0';
        const avgTime = total > 0 ? Math.round(requests.reduce((acc, r) => acc + r.duration, 0) / total) : 0;
        return { total, errors, successRate, avgTime };
    }, [requests]);

    const handleClear = useCallback(() => {
      if (window.confirm('Are you sure you want to clear all requests? This action cannot be undone.')) {
        clearAllRequests();
      }
    }, [clearAllRequests]);

    const exportRequests = useCallback(() => {
        const dataStr = JSON.stringify(requests, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `api-requests-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [requests]);

    return (
        <>
            <section className={`bg-white rounded-xl shadow-lg mb-8 transition-all duration-300 ${debuggerEnabled ? 'p-6' : 'p-4'}`}>
                <div className={`flex justify-between items-center ${debuggerEnabled ? 'mb-6' : ''}`}>
                    <div>
                         <h2 className="text-xl font-bold text-gray-900 flex items-center">
                            <BarChart3 className="mr-2 text-blue-600"/> API Debugger Pro
                        </h2>
                    </div>
                    <div className="flex items-center space-x-4">
                        <SwitchToggle label={debuggerEnabled ? "Debug Active" : "Debug Inactive"} enabled={debuggerEnabled} onChange={setDebuggerEnabled} />
                        <SwitchToggle label={widgetEnabled ? "Widget Enabled" : "Widget Disabled"} enabled={widgetEnabled} onChange={setWidgetEnabled} disabled={!debuggerEnabled} />
                    </div>
                </div>
                {debuggerEnabled && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <StatCard icon={<Database size={18} className="text-blue-500"/>} label="Total" value={stats.total.toString()} />
                            <StatCard icon={<CheckCircle size={18} className="text-green-500"/>} label="Success Rate" value={`${stats.successRate}%`} />
                            <StatCard icon={<Clock size={18} className="text-orange-500"/>} label="Avg Time" value={`${stats.avgTime}ms`} />
                            <StatCard icon={<XCircle size={18} className="text-red-500"/>} label="Errors" value={stats.errors.toString()} />
                        </div>
                        <div className="flex items-center space-x-2">
                            <button onClick={handleClear} disabled={requests.length === 0} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                <Trash2 size={16} /><span>Clear All</span>
                            </button>
                            <button onClick={exportRequests} disabled={requests.length === 0} className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                <Download size={16} /><span>Export</span>
                            </button>
                        </div>
                    </>
                )}
            </section>

            <LiveApiTable />
        </>
    );
});

const PageHeader = memo(() => {
    return (
        <div className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <nav className="flex" aria-label="Tabs">
                         <div
                            className={`bg-gray-100 text-gray-800 px-3 py-2 font-medium text-sm rounded-md flex items-center space-x-2`}
                         >
                            <Code size={16}/>
                            <span>Developer Tools</span>
                        </div>
                    </nav>
                </div>
            </div>
        </div>
    );
});

const CustomSimulation = memo(() => {
    const { addRequest, debuggerEnabled } = useApiDebugger();
    const [url, setUrl] = useState('https://api.myapp.com/v1/custom/action');
    const [method, setMethod] = useState<HttpMethod>('POST');
    const [status, setStatus] = useState('418');
    const [response, setResponse] = useState('{"message": "I\'m a teapot"}');

    // --- Template State ---
    const [templates, setTemplates] = useState<Record<string, RequestTemplate>>({});
    const [selectedTemplate, setSelectedTemplate] = useState('');

    const TEMPLATES_STORAGE_KEY = 'apiDebugger_requestTemplates';

    useEffect(() => {
        try {
            const storedTemplates = localStorage.getItem(TEMPLATES_STORAGE_KEY);
            if (storedTemplates) {
                setTemplates(JSON.parse(storedTemplates));
            }
        } catch (e) {
            console.error("Failed to load templates from localStorage", e);
        }
    }, []);

    const saveTemplates = (newTemplates: Record<string, RequestTemplate>) => {
        try {
            localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(newTemplates));
            setTemplates(newTemplates);
        } catch (e) {
            console.error("Failed to save templates to localStorage", e);
        }
    };

    const handleSaveTemplate = () => {
        const name = prompt("Enter a name for this template:");
        if (name) {
            if (templates[name]) {
                if (!window.confirm(`A template named "${name}" already exists. Overwrite it?`)) {
                    return;
                }
            }
            // SECURITY FIX: Mask sensitive data before saving to localStorage
            const newTemplate: RequestTemplate = { 
                url: maskUrl(url), 
                method, 
                status, 
                response: maskString(response) 
            };
            const updatedTemplates = { ...templates, [name]: newTemplate };
            saveTemplates(updatedTemplates);
            alert(`Template "${name}" saved.`);
        }
    };

    const handleLoadTemplate = () => {
        if (!selectedTemplate || !templates[selectedTemplate]) return;
        const template = templates[selectedTemplate];
        setUrl(template.url);
        setMethod(template.method);
        setStatus(template.status);
        setResponse(template.response);
    };

    const handleDeleteTemplate = () => {
        if (!selectedTemplate || !templates[selectedTemplate]) return;
        if (window.confirm(`Are you sure you want to delete the "${selectedTemplate}" template?`)) {
            const { [selectedTemplate]: _, ...remainingTemplates } = templates;
            saveTemplates(remainingTemplates);
            setSelectedTemplate('');
            alert(`Template "${selectedTemplate}" deleted.`);
        }
    };

    const handleSimulate = useCallback(() => {
        if (!debuggerEnabled) {
            alert("'Debug Active' is turned off. Please enable it to capture new requests.");
            return;
        }

        let parsedResponse: unknown;
        try {
            parsedResponse = JSON.parse(response);
        } catch {
            parsedResponse = { error: "Invalid JSON in response body field." };
        }

        const statusCode = parseInt(status, 10);
        if (isNaN(statusCode)) {
            alert("Status code must be a number.");
            return;
        }

        addRequest({
            method,
            url,
            status: statusCode,
            duration: Math.floor(50 + Math.random() * 200),
            size: new Blob([response]).size,
            requestHeaders: { 'Content-Type': 'application/json', 'X-Simulated': 'true' },
            responseHeaders: { 'Server': 'API-Debugger-Custom-Server', 'Content-Type': 'application/json' },
            requestBody: { simulated: true },
            responseBody: parsedResponse,
            error: statusCode >= 400 ? `Simulated error with status ${statusCode}` : null,
            statusText: statusCode === 418 ? "I'm a teapot" : "Simulated Response"
        });
    }, [addRequest, debuggerEnabled, url, method, status, response]);

    return (
        <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Custom Simulation</h3>
            <p className="text-sm text-gray-600 mb-6">Dynamically generate custom API calls and error responses. Save and load common scenarios as templates.</p>
            
            <div className="bg-gray-100 p-4 rounded-lg border mb-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Request Templates</h4>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={selectedTemplate}
                        onChange={e => setSelectedTemplate(e.target.value)}
                        className="flex-grow px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">-- Select a template --</option>
                        {Object.keys(templates).sort().map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    <button onClick={handleLoadTemplate} disabled={!selectedTemplate} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50">Load</button>
                    <button onClick={handleDeleteTemplate} disabled={!selectedTemplate} className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-red-50 disabled:opacity-50">Delete</button>
                </div>
            </div>

            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                        <input type="text" value={url} onChange={e => setUrl(e.target.value)} className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                                <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option><option>PATCH</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Status Code</label>
                            <input type="number" value={status} onChange={e => setStatus(e.target.value)} className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"/>
                        </div>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Response Body (JSON)</label>
                    <textarea value={response} onChange={e => setResponse(e.target.value)} rows={3} className="w-full px-3 py-2 text-sm bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono"></textarea>
                </div>
                <div className="text-right flex items-center justify-end space-x-2">
                    <button onClick={handleSaveTemplate} className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <span>Save as Template</span>
                    </button>
                    <button onClick={handleSimulate} className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500" disabled={!debuggerEnabled}>
                        <PlayCircle size={16}/><span>Run Simulation</span>
                    </button>
                </div>
            </div>
        </div>
    );
});


// Demo page component
const EnhancedDemo = memo(() => {
  const { addRequest, debuggerEnabled } = useApiDebugger();

  const createTestRequest = useCallback((type: string) => {
    if (!debuggerEnabled) {
        alert("'Debug Active' is turned off. Please enable it to capture new requests.");
        return;
    };
    
    const scenarios: Record<string, Omit<ApiRequest, 'id' | 'timestamp' | 'securityIssues'>> = {
      success: { method: 'GET', url: 'https://api.example.com/v1/users/123', status: 200, duration: 145, size: 256, responseBody: { id: 123, name: 'John Doe' }, requestBody: null, error: null, statusText: 'OK', requestHeaders: { 'Authorization': 'Bearer FAKETOKEN' }, responseHeaders: { 'Content-Type': 'application/json' }},
      created: { method: 'POST', url: 'https://api.example.com/v1/products', status: 201, duration: 234, size: 450, responseBody: { id: 789, status: 'created' }, requestBody: { name: 'New Gadget' }, error: null, statusText: 'Created', requestHeaders: { 'Content-Type': 'application/json' }, responseHeaders: { 'Content-Type': 'application/json' }},
      notFound: { method: 'GET', url: 'http://api.insecure.com/v1/items/999?apiKey=12345SECRET', status: 404, duration: 89, size: 52, responseBody: { error: 'Not Found' }, requestBody: null, error: 'Resource not available', statusText: 'Not Found', requestHeaders: {}, responseHeaders: {}},
      unauthorized: { method: 'PUT', url: 'http://api.insecure.com/v1/admin/config', status: 401, duration: 123, size: 67, responseBody: { error: 'Unauthorized' }, requestBody: { setting: 'value' }, error: null, statusText: 'Unauthorized', requestHeaders: { 'Authorization': 'Basic dXNlcjpwYXNz' }, responseHeaders: {}},
      serverError: { method: 'GET', url: 'https://api.example.com/v1/reports/daily', status: 500, duration: 678, size: 89, responseBody: { error: 'Internal Server Error' }, requestBody: null, error: 'Database connection timeout', statusText: 'Internal Server Error', requestHeaders: {}, responseHeaders: { 'X-Powered-By': 'OldFramework' }},
      slow: { method: 'POST', url: 'https://api.example.com/v1/analytics/compute', status: 200, duration: 3456, size: 15678, responseBody: { status: 'completed' }, requestBody: { query: 'long_running_query' }, error: null, statusText: 'OK', requestHeaders: {}, responseHeaders: {}},
    };
    addRequest(scenarios[type]);
  }, [addRequest, debuggerEnabled]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
        <PageHeader />
        <main className="p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <ApiDebuggerDashboard />
        
                {debuggerEnabled && (
                    <section className="bg-white rounded-xl shadow-lg p-6 mt-8">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Pre-defined Simulations</h2>
                        <p className="text-sm text-gray-600 mb-6">Click buttons to generate test API requests. 'Debug Active' must be on.</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
                            <TestButton onClick={() => createTestRequest('success')} className="bg-green-500 hover:bg-green-600" icon={<Zap size={16}/>} title="Success (200)" description="Successful API response"/>
                            <TestButton onClick={() => createTestRequest('created')} className="bg-blue-500 hover:bg-blue-600" icon={<Database size={16}/>} title="Created (201)" description="Resource creation success" />
                            <TestButton onClick={() => createTestRequest('notFound')} className="bg-red-500 hover:bg-red-600" icon={<AlertCircle size={16}/>} title="Not Found (404)" description="Insecure URL w/ key" />
                            <TestButton onClick={() => createTestRequest('unauthorized')} className="bg-orange-500 hover:bg-orange-600" icon={<Shield size={16}/>} title="Unauthorized (401)" description="Auth over HTTP" />
                            <TestButton onClick={() => createTestRequest('serverError')} className="bg-purple-500 hover:bg-purple-600" icon={<AlertCircle size={16}/>} title="Server Error (500)" description="Missing security headers" />
                            <TestButton onClick={() => createTestRequest('slow')} className="bg-yellow-500 hover:bg-yellow-600" icon={<Clock size={16}/>} title="Slow Response" description="Performance testing" />
                        </div>
                        <CustomSimulation />
                        <DebugStatus />
                    </section>
                )}
            </div>
        </main>
      <ApiDebuggerWidget />
    </div>
  );
});


interface TestButtonProps { onClick: () => void; className: string; icon: React.ReactNode; title: string; description: string; }
const TestButton = memo(({ onClick, className, icon, title, description }: { onClick: () => void; className: string; icon: React.ReactNode; title: string; description: string; }) => (
  <button
    onClick={onClick}
    className={`${className} text-white px-4 py-3 rounded-lg transition-all duration-200 flex flex-col items-center justify-center space-y-1 shadow-md hover:shadow-lg text-center`}
  >
    <div className="flex items-center space-x-2">
      {icon}
      <span className="font-medium text-sm">{title}</span>
    </div>
    <span className="text-xs opacity-90">{description}</span>
  </button>
));

const App = () => {
  return (
    <ErrorBoundary>
        <ApiDebuggerProvider>
          <EnhancedDemo />
        </ApiDebuggerProvider>
    </ErrorBoundary>
  );
};

export default App;
