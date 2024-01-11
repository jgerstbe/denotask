import { WebSocketServer } from "./deps.ts";

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
