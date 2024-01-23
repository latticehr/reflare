import useReflare from "../src";

const fetchMock = getMiniflareFetchMock();

fetchMock.disableNetConnect();

const origin = fetchMock.get("https://test-domain.com");

test("upstream -> basic", async () => {
  origin.intercept({ path: "/get" }).reply(200);

  const request = new Request("https://localhost/get");

  const reflare = await useReflare();

  reflare.push({
    path: "/*",
    upstream: { domain: "test-domain.com" },
  });

  const response = await reflare.handle(request);

  expect(response.status).toBe(200);
  expect(response.url).toBe("https://test-domain.com/get");
});

// Ensure Regex matches against array of paths
test("upstream -> path array", async () => {
  origin.intercept({ path: "/status/200" }).reply(200);

  const request = new Request("https://localhost/status/200");

  const reflare = await useReflare();

  reflare.push({
    path: ["/wont/match", "/also/wont/match", "/status*"],
    upstream: { domain: "test-domain.com" },
  });

  const response = await reflare.handle(request);

  expect(response.status).toBe(200);
  expect(response.url).toBe("https://test-domain.com/status/200");
});

// intercept a request with a specific pathname, (/foo/bar/baz)
// rewrite the request to a different pathname before it's sent
test("upstream -> onRequest", async () => {
  origin.intercept({ path: "/get" }).reply(200);
  const request = new Request("https://localhost/foo/bar/baz");
  const reflare = await useReflare();

  reflare.push({
    path: "/foo*",
    upstream: {
      domain: "test-domain.com",
      onRequest: (_req, url) => {
        const next: string = url.replace("foo/bar/baz", "get");

        return new Request(next);
      },
    },
  });

  const response = await reflare.handle(request);

  expect(response.status).toBe(200);
  expect(response.url).toBe("https://test-domain.com/get");
});

// intercept response and modify it before returning it to caller
test("upstream -> onRespone", async () => {
  origin.intercept({ path: "/foo/bar/baz" }).reply(200);
  const request = new Request("https://localhost/foo/bar/baz");
  const reflare = await useReflare();

  reflare.push({
    path: "/foo*",
    upstream: {
      domain: "test-domain.com",
      onResponse: [
        (res: Response): Response => {
          const result = 1 + 1;
          res.headers.set("x-foo", result.toString());
          return res;
        },
        (res: Response): Response => {
          res.headers.set("x-bar", "foo");
          return res;
        },
      ],
    },
  });

  const response = await reflare.handle(request);

  expect(response.headers.get("x-foo")).toEqual("2");
  expect(response.headers.get("x-bar")).toEqual("foo");
});
