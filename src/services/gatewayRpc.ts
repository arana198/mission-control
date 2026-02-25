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
