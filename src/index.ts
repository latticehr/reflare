export type OnResponseCallback = (k: Response, url: string) => Response;
export type OnRequestCallback = (
  k: Request,
  url: string
) => Request | Promise<Request>;

export interface UpstreamOptions {
  domain: string;
  protocol?: "http" | "https";
  port?: number;
  timeout?: number;
  onResponse?: OnResponseCallback | OnResponseCallback[];
  onRequest?: OnRequestCallback | OnRequestCallback[];
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

export function isUrlMatch<P extends PathMatcher>(
  request: Request,
  matchers: P[]
): P | void {
  const url = new URL(request.url);

  for (const route of matchers) {
    if (route.methods === undefined || route.methods.includes(request.method)) {
      const match = convertToArray<string>(route.path).some((path) => {
        const pattern = new URLPattern({ pathname: path });
        return pattern.test(url);
      });

      if (match) {
        return route;
      }
    }
  }

  return undefined;
}

export default async function useReflare(): Promise<Reflare> {
  const pipeline = usePipeline(useUpstream);

  const routeList: RouteList = [];

  async function handle(request: Request): Promise<Response> {
    const route = isUrlMatch(request, routeList);

    if (route === undefined) {
      return createResponse(
        "Failed to find a route that matches the path and method of the current request",
        500
      );
    }

    const context: Context = {
      request,
      route,
      hostname: getHostname(request),
      response: new Response("Unhandled response"),
      upstream: route.upstream,
    };

    try {
      await pipeline.execute(context);
    } catch (error) {
      if (error instanceof Error) {
        context.response = createResponse(error.message, 500);
      }
    }

    return context.response;
  }

  function unshift(route: Route) {
    routeList.unshift(route);
  }

  function push(route: Route) {
    routeList.push(route);
  }

  return {
    handle,
    unshift,
    push,
  };
}

function usePipeline(...initMiddlewares: Middleware[]): Pipeline {
  const stack: Middleware[] = [...initMiddlewares];

  const push: Pipeline["push"] = (...middlewares: Middleware[]) => {
    stack.push(...middlewares);
  };

  const execute: Pipeline["execute"] = async (context) => {
    const runner = async (prevIndex: number, index: number): Promise<void> => {
      if (index === prevIndex) {
        throw new Error("next() called multiple times");
      }
      if (index >= stack.length) {
        return;
      }

      const middleware = stack[index];
      const next = async () => runner(index, index + 1);
      await middleware(context, next);
    };

    await runner(-1, 0);
  };

  return {
    push,
    execute,
  };
}

const createResponse = (body: string, status: number): Response =>
  new Response(body, { status });

const getHostname = (request: Request): string => {
  const url = new URL(request.url);

  return url.host;
};

export function isPathMatch(
  request: Request,
  paths: string[]
): ReturnType<typeof isUrlMatch> {
  const pathMatchers = paths.map((path) => ({ path }));
  return isUrlMatch(request, pathMatchers);
}

export function cloneRequest(
  // string for outgoing request
  url: string,
  // outgoing request object, an extension of the original Cloudflare request object
  request: Request,
  // properties we want override on the original request object
  overrides?: RequestInit
): Request {
  if (!request.redirect) {
    console.error(
      'Request#redirect property not passed into cloneRequest()!, it will be reset to {redirect:"follow"} which may break 30x redirects downstream!'
    );
  }

  const requestInit: RequestInit = {
    // Ensure outgoing.redirect is copied over, otherwise it'll default
    // to redirect: "follow", which breaks 30x redirect's downstream
    // Workers by redirect: "manual", this keep's that (desired) behavior
    redirect: request.redirect,
    body: request.body,
    method: request.method,
    headers: request.headers,
    // @ts-expect-error this property exists within the Cloudflare context
    cf: request.cf,
    ...overrides,
  };

  return new Request(url, requestInit);
}

function getURL(url: string, upstream: UpstreamOptions): string {
  const cloneURL = new URL(url);
  const { domain, port, protocol } = upstream;

  cloneURL.hostname = domain;

  if (protocol !== undefined) {
    cloneURL.protocol = `${protocol}:`;
  }

  if (port === undefined) {
    cloneURL.port = "";
  } else {
    cloneURL.port = port.toString();
  }

  return cloneURL.href;
}

const useUpstream: Middleware = async (
  context: Context,
  next: () => Promise<void | null> | void | null
) => {
  const { request, upstream } = context;

  if (upstream === null) {
    await next();
    return;
  }

  const onRequest = upstream.onRequest
    ? convertToArray<OnRequestCallback>(upstream.onRequest)
    : null;

  const onResponse = upstream.onResponse
    ? convertToArray<OnResponseCallback>(upstream.onResponse)
    : null;

  const url = getURL(request.url, upstream);

  let upstreamRequest = cloneRequest(url, request);

  if (onRequest) {
    async function processRequests(
      upstreamRequest: Request,
      onRequest: OnRequestCallback[],
      url: string
    ): Promise<Request> {
      return onRequest.reduce(
        async (prevPromise: Promise<Request>, fn: OnRequestCallback) => {
          const prevReq: Request = await prevPromise; // Ensure the previous promise resolves
          return fn(await cloneRequest(url, prevReq), url); // Call the current function with the cloned request
        },
        Promise.resolve(upstreamRequest)
      );
    }

    upstreamRequest = await processRequests(upstreamRequest, onRequest, url);
  }

  context.response = await fetch(upstreamRequest);

  if (onResponse) {
    context.response = onResponse.reduce(
      (prevRes: Response, fn: OnResponseCallback) =>
        fn(new Response(prevRes.body, prevRes), url),
      new Response(context.response.body, context.response)
    );
  }

  await next();
};

const convertToArray = <T>(maybeArray: T | T[]): T[] => {
  return Array.isArray(maybeArray) ? maybeArray : [maybeArray];
};
