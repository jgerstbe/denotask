
import { WebSocketClient } from "https://deno.land/x/wocket@v1.0.0/mod.ts";
import { Callback, DenotaskRequest, DenotaskResponse } from "./types.ts";

let requestHandlerFunction: Callback;

export function handleRequest(handler: Callback) {
    console.log('requestHandlerFunction', requestHandlerFunction)
    requestHandlerFunction = handler;
}

const wssAddress = Deno.args[0];
const wssChannel = Deno.args[1];
if (!wssAddress || !wssChannel) Deno.exit();

const client = new WebSocketClient(wssAddress);
client.onopen = () => client.to(wssChannel, 'pingpong');
client.on(wssChannel, (event: unknown) => {
    console.log(`Handler for ${wssChannel} got a message!`, event);
    if (!requestHandlerFunction) throw new Error("No request handler was registered!");

    const denotaskRequest:DenotaskRequest = event as DenotaskRequest;
    try {
        denotaskRequest.url = new URL(denotaskRequest.url);
    } catch {
        throw new Error("Failed to parse request!");
    }

    requestHandlerFunction(denotaskRequest).then((response: DenotaskResponse) => {
        try {
            client.to(wssChannel, response);
        } catch {
            throw new Error("Failed to send response!");
        } finally {
            client.close();
        }
    });
});
