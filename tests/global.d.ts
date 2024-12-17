declare const getMiniflareFetchMock: () => any;

// Add URLPattern types
declare class URLPattern {
  constructor(init?: URLPatternInit | string, baseURL?: string);
  test(input?: URLPatternInput, baseURL?: string): boolean;
  exec(input?: URLPatternInput, baseURL?: string): URLPatternResult | null;
  readonly protocol: string;
  readonly username: string;
  readonly password: string;
  readonly hostname: string;
  readonly port: string;
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
}

interface URLPatternInit {
  protocol?: string;
  username?: string;
  password?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
  search?: string;
  hash?: string;
  baseURL?: string;
}

type URLPatternInput = string | URLPatternInit;

interface URLPatternResult {
  inputs: [URLPatternInput];
  protocol: { input: string; groups: Record<string, string> };
  username: { input: string; groups: Record<string, string> };
  password: { input: string; groups: Record<string, string> };
  hostname: { input: string; groups: Record<string, string> };
  port: { input: string; groups: Record<string, string> };
  pathname: { input: string; groups: Record<string, string> };
  search: { input: string; groups: Record<string, string> };
  hash: { input: string; groups: Record<string, string> };
}
