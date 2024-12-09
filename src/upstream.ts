import {
  Middleware,
  UpstreamOptions,
  OnResponseCallback,
  OnRequestCallback,
} from "./types";

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

/**
 * The `useUpstream` middleware sents the request to the upstream and captures
 * the response.
 * @param context - The context of the middleware pipeline
 * @param next - The function to invoke the next middleware in the pipeline
 */
export const useUpstream: Middleware = async (context, next) => {
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

export const convertToArray = <T>(maybeArray: T | T[]): T[] => {
  return Array.isArray(maybeArray) ? maybeArray : [maybeArray];
};
