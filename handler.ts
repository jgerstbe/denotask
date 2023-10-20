import { Callback, DenotaskRequest, DenotaskResponse } from "./types.ts";

const wsPort = Deno.args[0];
if (!wsPort) Deno.exit();

let requestHandlerFunction: Callback;

const ws = new WebSocket(`ws://localhost:${wsPort}`);

ws.addEventListener("message", (event) => {
    if (!requestHandlerFunction) throw new Error("No request handler was registered!");

    let request: DenotaskRequest;
    try {
        request = JSON.parse(event.data);
        request.url = new URL(request.url);
    } catch {
        throw new Error("Failed to parse request!");
    }

    requestHandlerFunction(request).then((response: DenotaskResponse) => {
        try {
            ws.send(JSON.stringify(response));
        } catch {
            throw new Error("Failed to send response!");
        }
    });
});

ws.addEventListener("close", () => Deno.exit());

export function handleRequest(handler: Callback) {
    console.log('requestHandlerFunction', requestHandlerFunction)
    requestHandlerFunction = handler;
}
