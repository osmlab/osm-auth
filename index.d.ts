// Type definitions for osm-auth 1.0.1

declare namespace OSMAuth {
    interface OSMAuthConstructor {
        new (options: OSMAuthOptions): OSMAuthInstance;
    }

    interface OSMAuthInstance {
        popupWindow?: Window
        logout(): OSMAuthInstance;
        authenticated(): boolean;
        authenticate(callback: (error: null | ErrorEvent | XMLHttpRequest, oauth?: OSMAuthInstance) => any): any;
        bringPopupWindowToFront(): boolean;
        xhr(options: OSMAuthXHROptions, callback: (error: null | ErrorEvent | XMLHttpRequest, xhr: any) => any): any;
        options(): OSMAuthOptions;
        options(options: OSMAuthNewOptions): OSMAuthInstance;
        bootstrapToken(oauth_token: string, callback: (error: null | ErrorEvent | XMLHttpRequest, oauth?: OSMAuthInstance) => any): any;
        preauth(options: OSMAuthOptions): OSMAuthInstance;
    }

    interface OSMAuthOptions {
        oauth_consumer_key: string;
        oauth_secret: string;
        url?: string;
        auto?: boolean;
        loading?: () => any;
        done?: () => any;
        landing?: string;
        singlepage?: boolean;
    }

    interface OSMAuthNewOptions {
        oauth_consumer_key?: string;
        oauth_secret?: string;
        url?: string;
        auto?: boolean;
        loading?: () => any;
        done?: () => any;
        landing?: string;
        singlepage?: boolean;
    }

    interface OSMAuthXHROptions {
        path: string;
        method: 'POST' | 'PUT' | 'GET' | 'DELETE';
        content?: string;
        prefix?: boolean;
        options?: any;
    }
}

declare var osmAuth: OSMAuth.OSMAuthConstructor;

declare module "osm-auth" {
    export = osmAuth;
}