import { WebSocketServer } from "./WebSocketServer.ts";
import { sendReceiveTask } from './WebSocketServer.ts';
import { DenotaskRequest } from "./types.ts";

export async function handleTabTask(wss: WebSocketServer, denotaskRequest: DenotaskRequest, taskUrl: string) {
    try {
      console.warn('GOT a tab task', taskUrl);

      const clientId = wss.getHandlingClient(taskUrl);
      if (!clientId) return new Response('Handler not found', { status: 500 });

      const wsTaskResponse = await sendReceiveTask(wss, taskUrl, clientId, denotaskRequest);
      const denotaskResponse = wsTaskResponse.response;
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
