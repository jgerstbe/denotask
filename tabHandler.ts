import { WebSocketServer } from "./deps.ts";
import { sendReceiveTask } from './wss.ts';
import { DenotaskRequest } from "./types.ts";

const tabHandlerList = new Map<string, [string, number]>();
tabHandlerList.set('hello', ['nioadhaoshd-123123', 1]);

export async function handleTabTask(wss: WebSocketServer, denotaskRequest: DenotaskRequest, taskUrl: string) {
    try {
      const wssChannel = tabHandlerList.get(taskUrl);
      console.warn('GOT a tab task', taskUrl, 'handler', wssChannel);
      if (!wssChannel) return new Response('Handler not found', { status: 500 });

      const wsTaskResponse = await sendReceiveTask(wss, wssChannel, denotaskRequest);
      const denotaskResponse = wsTaskResponse.detail.packet.response;
      console.warn('GOT RESPONSE IN tabHanlder', denotaskResponse);
  
      if (typeof(denotaskResponse.payload) !== 'string') {
        denotaskResponse.mime = "application/json";
        denotaskResponse.payload = JSON.stringify(denotaskResponse.payload);
      };
      console.log('denotaskResponse.payload', denotaskResponse.payload);
  
      return new Response(denotaskResponse.payload as undefined, { 
        status: denotaskResponse.status,
        headers: {
          'Content-Type': denotaskResponse.mime || 'text/plain'
        }
      });
    } catch (error) {
      console.error('error', error);
      if (!error || !error.status || !error.payload) return new Response('Internal Server Error', { status: 500 });
      return new Response(error.payload, { status: error.status });
    }
}
