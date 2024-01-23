export type onResponseCallback = (k: Response, url: string) => Response;
export type onRequestCallback = (k: Request, url: string) => Request;

export interface UpstreamOptions {
  domain: string;
  protocol?: "http" | "https";
  port?: number;
  onResponse?: onResponseCallback | onResponseCallback[];
  onRequest?: onRequestCallback | onRequestCallback[];
}

export interface PathMatcher {
  path: string | string[];
  methods?: string[];
}

export interface Route extends PathMatcher {
  upstream: UpstreamOptions;
}

export interface Context {
  route: Route;
  hostname: string;
  request: Request;
  response: Response;
  upstream: UpstreamOptions | null;
}

export type RouteList = Route[];

export interface Reflare {
  handle: (request: Request) => Promise<Response>;
  unshift: (route: Route) => void;
  push: (route: Route) => void;
}

export type Middleware = (
  context: Context,
  next: () => Promise<void | null> | void | null
) => Promise<void | null> | void | null;

export interface Pipeline {
  push: (...middlewares: Middleware[]) => void | null;
  execute: (context: Context) => Promise<void | null>;
}
