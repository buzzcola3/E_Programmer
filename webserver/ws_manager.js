import { jsonrpc } from './js_jsonrpc2/serializer.js';

const wsUrl = `ws://${location.host}/ws`;
export let ws = null;

// Buffer to hold the last 64 RPC responses
export const receiveBuffer = [];
let rpcId = 0;

/**
 * Opens a new WebSocket connection and attaches appropriate event listeners.
 *
 * @param {boolean} [debug=false] - If true, outputs debug information.
 * @returns {Promise<WebSocket>} Resolves with the open WebSocket connection.
 */
export function connectToWS(debug = false) {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(wsUrl);

    ws.addEventListener('open', () => {
      if (debug) {
        console.log("WebSocket connection opened at", ws.url);
      }
      resolve(ws);
    });

    ws.addEventListener('message', (event) => {
      const response = jsonrpc.deserialize(event.data);
      if (debug) {
        console.log("Received message from WebSocket server:", response);
      }
      receiveBuffer.push(response);
      if (receiveBuffer.length > 64) {
        receiveBuffer.shift(); // Maintain buffer size
      }
    });

    ws.addEventListener('error', (error) => {
      if (debug) {
        console.error("WebSocket error:", error);
      }
      // Reject only if connection isn't already established.
      if (ws.readyState !== WebSocket.OPEN) {
        reject(error);
      }
    });

    ws.addEventListener('close', () => {
      if (debug) {
        console.log("WebSocket connection closed.");
      }
    });
  });
}

/**
 * Sends an RPC request via WebSocket. If the connection is not open or has been closed,
 * it attempts to connect/reconnect before sending the request.
 *
 * @param {string} method - The RPC method name.
 * @param {Object} params - The parameters for the RPC call.
 * @param {boolean} [debug=false] - If true, outputs debug information.
 * @returns {Promise<number>} A promise that resolves to the RPC request ID.
 */
export async function RPCCall(method, params, debug = false) {
  // Ensure a valid, open WebSocket exists.
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    if (debug) {
      console.log("WebSocket not open. Reconnecting...");
    }
    try {
      await connectToWS(debug);
    } catch (error) {
      throw new Error("Failed to connect to WebSocket: " + error);
    }
  }
  rpcId++;
  if (debug) {
    console.log(`Sending RPC request (id: ${rpcId}) for method "${method}" with params:`, params);
  }
  ws.send(jsonrpc.request(rpcId, method, params));
  return rpcId;
}

/**
 * Awaits the RPC response corresponding to the given request ID.
 *
 * @param {number} id - The RPC request ID.
 * @param {boolean} [debug=false] - If true, outputs debug information.
 * @returns {Promise<Object>} Resolves with the RPC response.
 * @throws {Error} If no response is received within 40 seconds.
 */
export async function getRPCResponse(id, debug = false) {
  const startTime = Date.now();
  while (Date.now() - startTime < 40000) { // Stop after 40 seconds
    const response = receiveBuffer.find(resp => resp.payload && resp.payload.id === id);
    if (response) {
      if (response.type === 'error') {
        throw new Error(`RPC error response for id ${id}: ${response.payload}`);
      }
      if (debug) {
        console.log(`Received RPC response for id ${id}:`, response);
      }
      return response;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timeout waiting for RPC response with id ${id}`);
}