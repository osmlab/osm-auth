// Type definitions for osm-auth

declare namespace OSMAuth {
  class osmAuth {
    constructor(options: OSMAuthOptions)
    popupWindow?: Window
    logout(): osmAuth;
    fetch(path: string, options: OSMAuthFetchOptions): Promise<Response>;
    authenticated(): boolean;
    authenticate(callback: (err: null | any, result?: any) => any, options?: LoginOptions): any;
    bringPopupWindowToFront(): boolean;
    bootstrapToken(oauth_token: string, callback: (err: null | any, result?: any) => any): any;
    xhr(options: OSMAuthXHROptions, callback: (err: null | any, result?: any) => any): XMLHttpRequest | null;
    rawxhr(method: string, url: string, access_token: string | null, data: any | null, headers: object | null, callback: (err: null | any, result?: any) => any): XMLHttpRequest;
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

  interface OSMAuthFetchOptions {
    method: 'POST' | 'PUT' | 'GET' | 'DELETE';
    body?: string;
    prefix?: boolean;
    headers?: object;
  }

  interface OSMAuthXHROptions {
    method: 'POST' | 'PUT' | 'GET' | 'DELETE';
    path: string;
    content?: string;
    prefix?: boolean;
    headers?: object;
  }
}


declare module 'osm-auth' {
  export = OSMAuth;
}
