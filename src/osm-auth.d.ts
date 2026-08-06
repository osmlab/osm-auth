// Type definitions for osm-auth

declare namespace OSMAuth {
  class osmAuth {
    constructor(options: OSMAuthOptions)
    popupWindow?: Window
    logout(): osmAuth;
    fetch(path: string, options: OSMAuthFetchOptions): Promise<Response>;
    authenticated(): boolean;
    authenticate(callback: (err: null | any, result?: osmAuth) => void, options?: LoginOptions): void;
    bringPopupWindowToFront(): boolean;
    bootstrapToken(oauth_token: string, callback: (err: null | any, result?: osmAuth) => void): void;
    xhr(options: OSMAuthXHROptions, callback: (err: null | any, result?: any) => void): XMLHttpRequest | null;
    rawxhr(method: string, url: string, access_token: string | null, data: Document | XMLHttpRequestBodyInit | null | undefined, headers: Record<string, string> | null, callback: (err: null | any, result?: any) => void): XMLHttpRequest;
    preauth(options: OSMAuthOptions): osmAuth;
    options(): OSMAuthOptions;
    options(options: OSMAuthOptions): osmAuth;
  }

  interface LoginOptions {
    switchUser?: boolean;
  }

  interface OSMAuthOptions {
    scope: string;
    client_id: string;
    redirect_uri: string;
    access_token?: string;
    url?: string;
    apiUrl?: string;
    auto?: boolean;
    singlepage?: boolean;
    loading?: () => any;
    done?: () => any;
    locale?: string;
  }

  interface OSMAuthFetchOptions extends Omit<RequestInit, 'headers'> {
    headers?: Record<string, string>;
  }

  interface OSMAuthXHROptions {
    method: 'POST' | 'PUT' | 'GET' | 'DELETE';
    path: string;
    content?: Document | XMLHttpRequestBodyInit | null;
    prefix?: boolean;
    headers?: Record<string, string>;
  }
}


declare module 'osm-auth' {
  export = OSMAuth;
}
