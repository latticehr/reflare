<h1 align="center">
  Reflare 🌤️
</h1>

<p align="center">
Build proxy piplines with <a href="https://workers.cloudflare.com/">Cloudflare Workers</a>
</p>

> This package is was originally based on a now-deleted project https://github.com/xiaoyang-sde/reflare. We've heavily modified the original code and removed some functionality.

**Reflare** is a lightweight and scalable reverse proxy library built for Cloudflare Workers. It sits in front of web servers (e.g. web application, storage platform, or RESTful API), forwards HTTP requests or WebSocket traffic from clients to upstream servers, and transforms requests and responses with several optimizations to improve page loading time.

## Installation

```bash
$ pnpm install @latticehr/reflare
```

```bash
$ bun install @latticehr/reflare
```

```bash
$ npm install --save @latticehr/reflare
```

```bash
$ yarn add @latticehr/reflare
```

## Usage

```typescript
import useReflare from "@latticehr/reflare";

export default {
  async fetch(request: Request): Promise<Response> {
    const reflare = await useReflare();

    reflare.push({
      path: ["/api*", "/health"],
      upstream: {
        domain: "httpbin.org",
        protocol: "https",
      },
      onRequest: (request: Request) => request,
      onResponse: (response: Response) => response,
    });

    return reflare.handle(request);
  },
};
```

## Types

`Reflare` uses TypeScript for type-checking. Here are some of the key types used for configuring upstreams:

```ts
// Callback types for request and response manipulation
export type onResponseCallback = (response: Response, url: string) => Response;
export type onRequestCallback = (request: Request, url: string) => Request;

// Options for configuring upstream servers
export interface UpstreamOptions {
  domain: string;
  protocol?: "http" | "https";
  port?: number;
  onResponse?: onResponseCallback | onResponseCallback[];
  onRequest?: onRequestCallback | onRequestCallback[];
}
```

## Examples

#### Mirror [MDN Web Docs](https://developer.mozilla.org/en-US/)

Set up a reverse proxy for MDN Web Docs:

```typescript
{
  path: '/*',
  upstream: {
    domain: 'developer.mozilla.org',
    protocol: 'https',
  },
}
```

#### S3 Bucket

Set up a reverse proxy for https://example.s3.amazonaws.com and add custom headers to the response:

```typescript
{
  path: '/*',
  upstream: {
    domain: 'example.s3.amazonaws.com',
    protocol: 'https',
  },
  onResponse: (response: Response) => {
    response.headers.set('x-response-header', 'Hello from Reflare');
    return response;
  },
}
```

`onRequest` and `onResponse` fields accept callback functions or an array of callback functions that can change the content of the request or response. For example, the following example replaces the URL of the request and sets the cache-control header of the response based on its URL. These fields accept either a standalone function or a list of functions. The function could be either async or non-async.

```typescript
reflare.push({
  path: "/*",
  upstream: {
    domain: "httpbin.org",
    protocol: "https",
    port: 443,

    onRequest: (request: Request, url: string): Request => {
      // Modifies the URL of the request
      return new Request(url.replace("/original/request/path", ""), request);
    },

    onResponse: (response: Response, url: string): Response => {
      // If the URL ends with `.html` or `/`, sets the `cache-control` header
      if (url.endsWith(".html") || url.endsWith("/")) {
        response.headers.set(
          "cache-control",
          "public, max-age=240, s-maxage=60"
        );
      }
      return response;
    },
  },
});
```

## Contributing

We welcome contributions! If you have ideas for improvements or have found a bug, please feel free to open an issue or submit a pull request.

## Contributor License Agreement

By contributing to Reflare, you agree to the terms of our Contributor License Agreement (CLA) outlined [here](CLA_DOCUMENT.md). This agreement helps ensure that your contributions are used in a manner consistent with the project's goals and legal requirements.

Why a CLA?
A CLA clarifies the rights you, as a contributor, are granting to us, the maintainers of Reflare. It ensures that you understand your rights and agree to share your contributions under the same license as the project. This helps us maintain the project's open-source nature.

How to Agree to the CLA
When you submit a pull request, you are implicitly acknowledging and agreeing to the terms of the CLA. This is a standard practice to protect you, the project, and users of the project. It ensures that the contributions can be freely used while protecting your rights as a contributor.

Questions or Concerns?
If you have any questions or concerns about the CLA, please open an issue for discussion before making a contribution.
