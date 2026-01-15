import type { ApiRequest, SecurityIssue } from '../types';

export function analyzeRequestSecurity(request: ApiRequest): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    let url: URL;
    try {
        const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        url = new URL(request.url, base);
    } catch {
        // If URL is hopelessly invalid, return empty issues or a specific error
        return [];
    }

    // 1. Check for insecure transport (HTTP)
    // Only flag if it's an absolute URL using http, or a relative URL on an http origin
    if (url.protocol === 'http:') {
        issues.push({
            severity: 'high',
            type: 'Insecure Transport',
            message: 'Request was made over unencrypted HTTP.',
            recommendation: 'Use HTTPS to protect data in transit.',
        });
    }

    // 2. Check for sensitive data in URL query parameters
    const sensitiveParams = ['api_key', 'apikey', 'token', 'password', 'secret', 'client_secret', 'access_token'];
    url.searchParams.forEach((value, key) => {
        if (sensitiveParams.some(p => key.toLowerCase().includes(p))) {
            issues.push({
                severity: 'high',
                type: 'Sensitive Data in URL',
                message: `A potentially sensitive key "${key}" was found in the URL.`,
                recommendation: 'Pass sensitive data in request headers (e.g., Authorization) or the request body, not in the URL.',
            });
        }
    });
    
    // 3. Check for missing security headers in response
    const responseHeaders = Object.keys(request.responseHeaders).map(k => k.toLowerCase());
    const recommendedHeaders = [
      'strict-transport-security',
      'content-security-policy',
      'x-content-type-options',
      'x-frame-options'
    ];
    
    recommendedHeaders.forEach(header => {
      if (!responseHeaders.includes(header)) {
        issues.push({
          severity: 'medium',
          type: 'Missing Security Header',
          message: `The response is missing the "${header}" header.`,
          recommendation: `Implement the ${header} header to enhance security against attacks like clickjacking and XSS.`,
        });
      }
    });

    // 4. Check for authentication headers over HTTP
    if (url.protocol === 'http:' && (request.requestHeaders['Authorization'] || request.requestHeaders['authorization'])) {
         issues.push({
            severity: 'high',
            type: 'Credentials over HTTP',
            message: 'An Authorization header was sent over an insecure HTTP connection.',
            recommendation: 'Always use HTTPS when sending authentication credentials.',
        });
    }

    return issues;
}