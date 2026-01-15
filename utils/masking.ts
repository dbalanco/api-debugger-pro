import type { ApiRequest } from '../types';

export const SENSITIVE_PATTERNS = [
    'authorization', 'cookie', 'set-cookie', 'x-api-key', 'api-key', 'apikey', 'token', 
    'password', 'secret', 'cvv', 'ssn', 'access_token', 'refresh_token', 'client_secret'
];
export const MASK = '********';

/**
 * Helper to check if an object is a "plain" object that we should traverse.
 * Prevents corruption of Blobs, Files, Dates, etc.
 */
function isPlainObject(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    // Safer check than constructor === Object for cross-realm objects
    return Object.prototype.toString.call(obj) === '[object Object]';
}

/**
 * Recursively masks sensitive keys in an object or array.
 */
export function maskObject(obj: any): any {
    if (!obj) return obj;
    if (typeof obj !== 'object') return obj;

    // Handle Arrays
    if (Array.isArray(obj)) {
        return obj.map(maskObject);
    }

    // Guard: Do not attempt to mask non-plain objects (Blob, Date, etc) to avoid corruption
    if (!isPlainObject(obj)) {
        return obj;
    }

    // Clone to avoid mutating original state references
    const maskedObj: any = {}; 
    
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const lowerKey = key.toLowerCase();
            // Check if the key itself matches a sensitive pattern
            if (SENSITIVE_PATTERNS.some(pattern => lowerKey.includes(pattern))) {
                maskedObj[key] = MASK;
            } else if (typeof obj[key] === 'object') {
                // Recurse
                maskedObj[key] = maskObject(obj[key]);
            } else {
                maskedObj[key] = obj[key];
            }
        }
    }
    return maskedObj;
}

/**
 * Masks sensitive query parameters in a URL string.
 * Handles relative URLs by using window.location.origin as a base.
 */
export function maskUrl(urlStr: string): string {
    try {
        // Handle relative URLs (e.g., "/api/login")
        const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
        const url = new URL(urlStr, base);
        
        let hasChanges = false;
        url.searchParams.forEach((value, key) => {
             const lowerKey = key.toLowerCase();
             if (SENSITIVE_PATTERNS.some(p => lowerKey.includes(p))) {
                 url.searchParams.set(key, MASK);
                 hasChanges = true;
             }
        });

        if (!hasChanges) return urlStr;

        // Return relative path if input was relative, else full URL
        if (urlStr.startsWith('/')) {
            return url.pathname + url.search + url.hash;
        }
        return url.toString();
    } catch (e) {
        // Fallback: If URL parsing completely fails, return original
        return urlStr;
    }
}

/**
 * Masks sensitive patterns in a raw string body (e.g. x-www-form-urlencoded or raw JSON string).
 */
export function maskString(str: string): string {
    if (!str || typeof str !== 'string') return str;
    let masked = str;
    
    SENSITIVE_PATTERNS.forEach(pattern => {
        // Regex explanation:
        // ([?&"']?) -> Preceding char (optional start of query param, quote, or ampersand)
        // (${pattern}) -> The sensitive key
        // (["']?) -> Optional closing quote for key
        // (\s*[:=]\s*) -> Separator (: or =) with optional whitespace
        // (["']?) -> Optional opening quote for value
        // ([^"'\s&,]+) -> The value (capture group 5) - stop at quote, whitespace, ampersand, or comma
        // (["']?) -> Optional closing quote for value
        const regex = new RegExp(`([?&"']?${pattern}["']?\\s*[:=]\\s*["']?)([^"'\s&,]+)(["']?)`, 'gi');
        masked = masked.replace(regex, '$1' + MASK + '$3');
    });
    return masked;
}

export function maskSensitiveData(request: ApiRequest): ApiRequest {
    const maskedRequest = { ...request };
    
    // Mask URL
    maskedRequest.url = maskUrl(request.url);

    // Mask Headers
    maskedRequest.requestHeaders = maskObject({ ...request.requestHeaders });
    maskedRequest.responseHeaders = maskObject({ ...request.responseHeaders });

    // Mask Request Body
    if (request.requestBody) {
        if (typeof request.requestBody === 'object') {
             maskedRequest.requestBody = maskObject(request.requestBody);
        } else if (typeof request.requestBody === 'string') {
             maskedRequest.requestBody = maskString(request.requestBody);
        }
    }

    // Mask Response Body
    if (request.responseBody) {
        if (typeof request.responseBody === 'object') {
             maskedRequest.responseBody = maskObject(request.responseBody);
        } else if (typeof request.responseBody === 'string') {
             maskedRequest.responseBody = maskString(request.responseBody);
        }
    }

    return maskedRequest;
}
