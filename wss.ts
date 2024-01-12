import { WebSocketServer } from "./deps.ts";
import { DenotaskRequest, HttpStatus, WsTaskRequest, WsTaskResponseEvent } from "./types.ts";

export function startWss(port: number, host = '127.0.0.1') {
    const wss = new WebSocketServer({
        hostname: host,
        port: port,
        protocol: 'ws'
    });
    wss.run();
    return wss;
}

export function registerChannel(server: WebSocketServer, channelName: string) {
    server.on(channelName, (event) => {
        // deno-lint-ignore no-explicit-any
        server.broadcast(channelName, event.detail.packet as any, event.detail.id);
    });
}

export function deleteChannel(server: WebSocketServer, channelName: string) {
    server.channels.delete(channelName);
}

export async function sendReceiveTask(server: WebSocketServer, connection: [string, number], denotaskRequest: DenotaskRequest)  {
    const requestId = crypto.randomUUID();
    const [channelName, targetId] = connection;

    const denotaskResponse = await new Promise<WsTaskResponseEvent>((resolve, reject) => {
        console.log('HANDLING', channelName, targetId, requestId);
        const request: WsTaskRequest = {
            id: requestId,
            request: denotaskRequest
        };
        server.to(channelName, request, targetId);

        server.on(channelName, (event:WsTaskResponseEvent) => {    
            console.log(`tabHandler for requestId ${requestId}:  got a response`, event);
            if (event.type !== channelName) return;
            if (event.detail.packet.requestId !== requestId) return;
            console.log(`tabHandler got a response for requestId ${requestId}:`, event.detail.packet);
            resolve(event);
        });

        // TODO should we return erros as json?
        setTimeout(() => {
            console.log('Listener timeout:', channelName, requestId);
            reject({
                status: HttpStatus.MISSDIRECTED_REQUEST,
                payload: 'No response received from upstream handler.'
            });            
        }, 5000);
    });

    return denotaskResponse;
}
