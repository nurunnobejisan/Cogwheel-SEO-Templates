/**
 * Platform HTTP Adapter (Phase 5)
 *
 * A dependency-free `node:http` bridge to `PlatformGateway.handle()`. The same
 * gateway is mounted by Next.js route handlers in the app; this adapter makes it
 * runnable standalone (workers, local development, integration tests) without
 * pulling in Express/Fastify.
 *
 * Authentication is injected: `createHeaderAuthenticator()` is a development
 * stand-in for real JWT/session verification.
 */

import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { PlatformGateway } from "./gateway.ts";
import type { HttpMethod, PlatformRequest, PlatformResponse, Principal, Role } from "./types.ts";

const METHODS: HttpMethod[] = ["GET", "POST", "PATCH", "DELETE"];
const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024;

export type Authenticator = (req: IncomingMessage) => Principal | undefined;

export interface HttpServerOptions {
  gateway: PlatformGateway;
  authenticate: Authenticator;
  maxBodyBytes?: number;
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Development authenticator reading actor headers without verification. */
export function createHeaderAuthenticator(): Authenticator {
  return (req) => {
    const id = header(req, "x-actor-id");
    if (!id) {
      return undefined;
    }
    const role = (header(req, "x-actor-role") ?? "viewer") as Role;
    const organizationId = header(req, "x-organization-id");
    return { id, role, organizationId };
  };
}

async function readBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > maxBytes) {
      throw Object.assign(new Error("request body too large"), { statusCode: 413 });
    }
    chunks.push(buffer);
  }
  if (size === 0) {
    return undefined;
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("invalid JSON body"), { statusCode: 400 });
  }
}

function send(res: ServerResponse, response: PlatformResponse): void {
  const payload = JSON.stringify(response.body);
  res.writeHead(response.status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...(response.headers ?? {}),
  });
  res.end(payload);
}

export function createHttpServer(options: HttpServerOptions): Server {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return createServer(async (req, res) => {
    try {
      const method = (req.method ?? "GET").toUpperCase();
      if (!METHODS.includes(method as HttpMethod)) {
        send(res, { status: 405, body: { error: { code: "method_not_allowed", message: method } } });
        return;
      }
      const principal: Principal =
        options.authenticate(req) ?? { id: "", role: "viewer" };
      const body = method === "GET" || method === "DELETE" ? undefined : await readBody(req, maxBodyBytes);
      const request: PlatformRequest = {
        method: method as HttpMethod,
        path: req.url ?? "/",
        body,
        principal,
      };
      send(res, await options.gateway.handle(request));
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode ?? 500;
      send(res, {
        status,
        body: {
          error: {
            code: status === 500 ? "internal_error" : "bad_request",
            message: error instanceof Error ? error.message : String(error),
          },
        },
      });
    }
  });
}

export interface StartServerOptions extends HttpServerOptions {
  port?: number;
  host?: string;
}

export interface RunningHttpServer {
  server: Server;
  url: string;
  close(): Promise<void>;
}

export async function startPlatformServer(
  options: StartServerOptions
): Promise<RunningHttpServer> {
  const server = createHttpServer(options);
  const port = options.port ?? 0;
  const host = options.host ?? "127.0.0.1";
  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    server,
    url: `http://${host}:${actualPort}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}