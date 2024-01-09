
import { WebSocketClient } from "./deps.ts";
import { Callback, DenotaskRequest, SimpleDenotaskResponse } from "./types.ts";

let requestHandlerFunction: Callback;

export function handleRequest(handler: Callback) {
    console.log('requestHandlerFunction', requestHandlerFunction)
    requestHandlerFunction = handler;
}

const wssAddress = Deno.args[0];
const wssChannel = Deno.args[1];
export const CWD = Deno.args[2];
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

    requestHandlerFunction(denotaskRequest).then((response: SimpleDenotaskResponse) => {
        try {
            client.to(wssChannel, response);
        } catch {
            throw new Error("Failed to send response!");
        } finally {
            client.close();
        }
    });
});
