// Small stand-ins for the browser APIs that osm-auth uses and Bun doesn't have:
// `localStorage`, `window` and `XMLHttpRequest`, plus a spy for `fetch`.


/** Defines (or replaces) a global, even one that was defined with a getter */
export function setGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, { value: value, configurable: true, writable: true });
}


/** A `Storage` backed by a `Map` */
export class MemoryStorage {
  private _map = new Map<string, string>();

  get length(): number { return this._map.size; }
  clear(): void { this._map.clear(); }
  key(i: number): string | null { return [...this._map.keys()][i] ?? null; }
  getItem(k: string): string | null { return this._map.get(k) ?? null; }
  setItem(k: string, v: string): void { this._map.set(k, String(v)); }
  removeItem(k: string): void { this._map.delete(k); }
  keys(): string[] { return [...this._map.keys()]; }
}


/** A `Location` that can tell a test where it navigates to next */
export class FakeLocation {
  search = '';
  private _href: string;
  private _waiters: Array<(href: string) => void> = [];

  constructor(href: string) {
    this._href = href;
  }

  get href(): string { return this._href; }
  set href(val: string) {
    this._href = val;
    const waiters = this._waiters;
    this._waiters = [];
    for (const resolve of waiters) resolve(val);
  }

  /** Resolves with the next URL assigned to `href` */
  nextNavigation(): Promise<string> {
    return new Promise(resolve => { this._waiters.push(resolve); });
  }
}


/** A popup window opened by `FakeWindow.open()` */
export class FakePopup {
  location: FakeLocation;
  closed = false;
  focusCount = 0;

  constructor(url: string) {
    this.location = new FakeLocation(url);
  }

  focus(): void { this.focusCount++; }
  close(): void { this.closed = true; }
}


/** The parts of `window` that osm-auth uses */
export class FakeWindow {
  screen = { width: 1000, height: 800 };
  location: FakeLocation = new FakeLocation('http://127.0.0.1:8080/');
  blockPopups = false;
  opened: Array<{ url: string, target: string, features: string, popup: FakePopup }> = [];

  open(url: string, target: string, features: string): FakePopup | null {
    if (this.blockPopups) return null;
    const popup = new FakePopup(url);
    this.opened.push({ url, target, features, popup });
    return popup;
  }

  /** The most recently opened popup */
  lastPopup(): FakePopup {
    const popup = this.opened.at(-1)?.popup;
    if (!popup) throw new Error('No popup was opened');
    return popup;
  }
}


/**
 * An `XMLHttpRequest` that records what was sent, and lets a test answer it.
 * Like a real one, it goes through readyState 1–4 (firing `onreadystatechange` each time),
 * only allows `setRequestHeader` between `open` and `send`, and ends an error, timeout or abort
 * with readyState 4 and status 0 before the event for it.
 */
export class FakeXHR {
  static requests: FakeXHR[] = [];
  private static _waiters: Array<(xhr: FakeXHR) => void> = [];

  method = '';
  url = '';
  async = false;
  headers: Record<string, string> = {};
  body: unknown = undefined;
  readyState = 0;
  status = 0;
  response: string = '';
  responseXML: unknown = null;
  timeout = 0;
  onreadystatechange: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  ontimeout: ((e: Event) => void) | null = null;
  onabort: ((e: Event) => void) | null = null;
  private _sent = false;

  /** Forgets all requests */
  static reset(): void {
    FakeXHR.requests = [];
    FakeXHR._waiters = [];
  }

  /** The most recent request */
  static last(): FakeXHR {
    const xhr = FakeXHR.requests.at(-1);
    if (!xhr) throw new Error('No XMLHttpRequest was sent');
    return xhr;
  }

  /** Resolves with the next request sent */
  static nextRequest(): Promise<FakeXHR> {
    return new Promise(resolve => { FakeXHR._waiters.push(resolve); });
  }

  open(method: string, url: string, async: boolean): void {
    this.method = method;
    this.url = url;
    this.async = async;
    this._setReadyState(1);
  }

  setRequestHeader(k: string, v: string): void {
    if (this.readyState !== 1 || this._sent) {
      throw new DOMException('setRequestHeader() must be called after open() and before send()', 'InvalidStateError');
    }
    this.headers[k] = v;
  }

  send(body: unknown): void {
    this.body = body;
    this._sent = true;
    FakeXHR.requests.push(this);
    const waiters = FakeXHR._waiters;
    FakeXHR._waiters = [];
    for (const resolve of waiters) resolve(this);
  }

  /** Aborts the request, as the caller can on a real one */
  abort(): void {
    this._end('abort', this.onabort);
  }

  /** Completes the request with an HTTP response */
  respond(status: number, response: string, responseXML: unknown = null): void {
    this.status = status;
    this._setReadyState(2);   // headers received
    this._setReadyState(3);   // loading
    this.response = response;
    this.responseXML = responseXML;
    this._setReadyState(4);
  }

  /** Fails the request as a network error, and returns the error event */
  fail(): Event {
    return this._end('error', this.onerror);
  }

  /** Fails the request as a timeout, and returns the timeout event */
  timeOut(): Event {
    return this._end('timeout', this.ontimeout);
  }

  private _setReadyState(state: number): void {
    this.readyState = state;
    this.onreadystatechange?.();
  }

  /** Ends the request without a response, like a real one: readyState 4 and status 0, then the event */
  private _end(type: string, handler: ((e: Event) => void) | null): Event {
    const e = new Event(type);
    this.status = 0;
    this._setReadyState(4);
    handler?.(e);
    return e;
  }
}


/** A `fetch` that records its calls and answers 'ok' */
export class FetchSpy {
  calls: Array<{ resource: unknown, init: RequestInit | undefined }> = [];

  fetch = (resource: unknown, init?: RequestInit): Promise<Response> => {
    this.calls.push({ resource, init });
    return Promise.resolve(new Response('ok'));
  };
}


/** Posts a redirect URL to the opener, the way `land.html` does */
export function postFromLandPage(url: string): void {
  const bc = new BroadcastChannel('osm-api-auth-complete');
  bc.postMessage(url);
  bc.close();
}
