// Type definitions for osm-auth

declare namespace OSMAuth {
  interface OSMAuthConstructor {
    new (options: OSMAuthOptions): OSMAuthInstance;
  }

  interface OSMAuthInstance {
    popupWindow?: Window
    logout(): OSMAuthInstance;
    fetch(path: string, options: OSMAuthFetchOptions): Promise;
    authenticated(): boolean;
    authenticate(callback: (err: null | any, result?: any) => any): any;
    bringPopupWindowToFront(): boolean;
    bootstrapToken(oauth_token: string, callback: (err: null | any, result?: any) => any): any;
    xhr(options: OSMAuthXHROptions, callback: (err: null | any, result?: any) => any): XMLHttpRequest | null;
    rawxhr(method: string, url: string, access_token: string | null, data: any | null, headers: object | null, callback: (err: null | any, result?: any) => any): XMLHttpRequest;
    preauth(options: OSMAuthOptions): OSMAuthInstance;
    options(): OSMAuthOptions;
    options(options: OSMAuthOptions): OSMAuthInstance;
  }

  interface OSMAuthOptions {
    scope: string;
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    access_token?: string;
    url?: string;
    auto?: boolean;
    singlepage?: boolean;
    loading?: () => any;
    done?: () => any;
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

declare var osmAuth: OSMAuth.OSMAuthConstructor;

declare module 'osm-auth' {
  export = osmAuth;
}
