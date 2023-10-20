import { Server } from "https://deno.land/x/wocket@v1.0.0/mod.ts";

export function startWss(port: number, host = 'localhost') {
    const wss = new Server({
        hostname: host,
        port: port,
        protocol: 'ws'
    });
    wss.run();
    return wss;
}

export function registerChannel(server: Server, channelName: string) {
    server.on(channelName, (event) => {
        // deno-lint-ignore no-explicit-any
        server.broadcast(channelName, event.detail.packet as any, event.detail.id);
    })
}
