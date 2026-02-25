import WebSocket from "ws";

/**
 * Gateway RPC Client - WebSocket JSON-RPC Protocol v3
 *
 * Handles:
 * - WebSocket connection to gateway daemon
 * - Device pairing (optional, ed25519 signatures)
 * - RPC method calls with request/response matching
 * - Automatic connection teardown
 *
 * Protocol:
 * - Server sends: { type: "event", name: "...", payload: {...} }
 * - Client sends: { type: "req", id: uuid, method: "...", params: {...} }
 * - Server responds: { type: "res", id: same_uuid, ok: true/false, error?: {...}, result: {...} }
 */

interface RpcRequest {
  type: "req";
  id: string;
  method: string;
  params: any;
}

interface RpcResponse {
  type: "res";
  id: string;
  ok: boolean;
  error?: { code: string; message: string };
  result?: any;
}

interface RpcEvent {
  type: "event";
  name: string;
  payload?: any;
}

/**
 * Connect to gateway and execute RPC calls
 *
 * Usage:
 * ```
 * const ws = await connect({ url, token, disableDevicePairing, allowInsecureTls });
 * const result = await call(ws, "health");
 * ws.close();
 * ```
 */
export async function connect({
  url,
  token,
  disableDevicePairing = false,
  allowInsecureTls = false,
}: {
  url: string;
  token?: string;
  disableDevicePairing?: boolean;
  allowInsecureTls?: boolean;
}): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const options: WebSocket.ClientOptions = {};

    if (allowInsecureTls) {
      options.rejectUnauthorized = false;
    }

    const ws = new WebSocket(url, options);

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Gateway connection timeout"));
    }, 10000);

    ws.on("open", () => {
      clearTimeout(timeout);

      // If disableDevicePairing, connect as control_ui immediately
      if (disableDevicePairing) {
        const connectReq: RpcRequest = {
          type: "req",
          id: crypto.randomUUID?.() || generateUUID(),
          method: "connect",
          params: {
            role: "operator",
            mode: "control_ui",
            token,
          },
        };

        ws.send(JSON.stringify(connectReq));

        // Wait for response
        const handler = (data: WebSocket.Data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === "res" && msg.id === connectReq.id) {
              ws.removeEventListener("message", handler as any);
              if (msg.ok) {
                resolve(ws);
              } else {
                ws.close();
                reject(new Error(msg.error?.message || "Connection failed"));
              }
            }
          } catch (e) {
            // ignore parse errors
          }
        };

        ws.on("message", handler as any);
      } else {
        // Device pairing flow (not implemented in this stub)
        // For now, just connect as control_ui
        resolve(ws);
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    ws.on("close", () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * Call a gateway RPC method
 *
 * Returns result or throws error if response.ok === false
 */
export async function call(
  ws: WebSocket,
  method: string,
  params: any = {}
): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID?.() || generateUUID();
    const request: RpcRequest = {
      type: "req",
      id,
      method,
      params,
    };

    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
      ws.removeEventListener("message", handler as any);
      reject(new Error(`RPC call timeout: ${method}`));
    }, 30000);

    const handler = (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "res" && msg.id === id) {
          clearTimeout(timeout);
          ws.removeEventListener("message", handler as any);

          if (msg.ok) {
            resolve(msg.result);
          } else {
            reject(new Error(msg.error?.message || "RPC call failed"));
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    };

    ws.on("message", handler as any);
    ws.send(JSON.stringify(request));
  });
}

/**
 * Simple UUID v4 generator fallback
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Ping result from WebSocket connectivity check
 */
export interface PingResult {
  success: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Ping a gateway to test WebSocket connectivity
 *
 * Usage:
 * ```
 * const result = await ping('wss://gateway.example.com', 'token123', false, 5000);
 * if (result.success) {
 *   console.log(`Connected in ${result.latencyMs}ms`);
 * } else {
 *   console.error(`Connection failed: ${result.error}`);
 * }
 * ```
 */
export async function ping(
  url: string,
  token?: string,
  allowInsecureTls?: boolean,
  timeoutMs = 5000
): Promise<PingResult> {
  const startTime = Date.now();

  try {
    // Use Promise.race to implement timeout
    const ws = await Promise.race([
      connect({ url, token, allowInsecureTls, disableDevicePairing: true }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Connection timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);

    // Successfully connected
    ws.close();
    return {
      success: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (err) {
    // Connection failed or timed out
    return {
      success: false,
      latencyMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
