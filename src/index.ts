import { useUpstream, convertToArray } from "./upstream";
import {
  Context,
  Reflare,
  Route,
  Pipeline,
  RouteList,
  Middleware,
  PathMatcher,
} from "./types";

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
