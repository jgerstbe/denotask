
import { Callback, WsTaskRequest } from "./types.ts";

let requestHandlerFunction: Callback;

export function handleRequest(handler: Callback) {
    console.log('requestHandlerFunction', requestHandlerFunction)
    requestHandlerFunction = handler;
}

const clientId = Deno.args[0];
const key = Deno.args[1];
const host = Deno.args[2];
export const CWD = Deno.args[3];
if (!clientId || !key) Deno.exit();

const client = new WebSocket(`ws://${host}?clientId=${clientId}&key=${key}`);
client.onmessage = onMessage;
async function onMessage(event: MessageEvent<string>) {
    console.log(`Handler for ${clientId} got a message!`, event);
    try {
        if (!requestHandlerFunction) {
            throw new Error("No request handler was registered!");
        }
        const { id, request } = JSON.parse(event.data) as WsTaskRequest;
        try {
            request.url = new URL(request.url);
        } catch {
            throw new Error("Failed to parse request!");
        }
    
        const response = await requestHandlerFunction(request);
        client.send(JSON.stringify({
            requestId: id,
            response
        }));
    } catch {
        throw new Error("Failed to send response!");
    } finally {
        client.close();
    }
}
