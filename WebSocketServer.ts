import { Ctx, Evt } from "./deps.ts";
import { DenotaskRequest, DenotaskResponse, HttpStatus } from "./types.ts";

export class WebSocketServer {
  private clients: Map<string, WebSocketClient> = new Map();
  // Map<tabPrefix, clientId>
  private handlers: Map<string, string> = new Map(); 

  addClient(socket: WebSocket, uuid?: string): WebSocketClient {
    if (!uuid) uuid = crypto.randomUUID();
    if (this.clients.has(uuid)) throw new Error('This UUID already exists!');
    const bus = Evt.create<WsTask>();
    const wsc: WebSocketClient = {
      id: uuid,
      socket,
      bus
    };
    this.clients.set(uuid, wsc);
    return wsc;
  }

  private removeClient(uuid: string) {
    this.clients.delete(uuid);
    this.handlers.forEach((value, key) => {
        if(value === uuid){
          console.log(`Removed client ${uuid} as handler for ${key}`);
          this.handlers.delete(key);
        }
    });
  }

  public sendToClient(uuid: string, payload: unknown) {
    const client = this.clients.get(uuid);
    if (!client) return new Error('Could not send, client not found.');
    client.socket.send(JSON.stringify(payload));
  }

  // deno-lint-ignore no-explicit-any
  public onClientMessage(uuid: string, callback: any) {
    const client = this.clients.get(uuid);
    if (!client) return new Error('Client not found.');
    const ctx = Evt.newCtx();
    client.bus.attach(ctx, callback);
    console.log('Handler length', client.bus.getHandlers().length);
    return ctx;
  }

  public upgradeAndHandleWs(request: Request) {
    const { response, socket } = Deno.upgradeWebSocket(request);
    const client = this.addClient(socket);
    this.attachClientHandler(client);
    return response;
  }

  private attachClientHandler(client: WebSocketClient) {
    client.socket.onopen = () => {
      console.log(`WS client connection opend for: ${client.id}`);
      client.socket.send(`You are Client ${client.id}`);
      client.bus.post({ type: 'OPEN' });
    };
    client.socket.onmessage = ev => {
      let messageBody = ev.data;
      try {
        messageBody = JSON.parse(messageBody);
        console.log(`Got message from ${client.id}:`, messageBody);
      } catch {
        const msg = `[${client.id}] Error while parsing messageBody: ${messageBody}`;
        client.socket.send(msg);
        return console.error(msg);
      }
      // register as tab handler
      if (messageBody.type === 'registerHandler') {
        // TODO check user rights
        if (this.handlers.has(messageBody.tab)) {
          const msg = `[${client.id}] a handler alredy exists for tab ${messageBody.tab}`;
          client.socket.send(msg);
          return console.error(msg);
        }
        const msg = `[${client.id}] Successfully set as handler for tab ${messageBody.tab}`;
        client.socket.send(msg);
        this.handlers.set(messageBody.tab, client.id);
      }
      // TODO validate WsTask Format
      const wsTask = messageBody as WsTask;
      client.bus.post(wsTask);
    };
    client.socket.onclose = closed => {
      console.log(`WS client connection closed for: ${client.id} with Code/Reason ${closed.code} ${closed.reason}`);
      client.bus.post({ type: 'CLOSE' });
      this.removeClient(client.id);
    }
  }

  public getHandlingClient(tabUrl: string) {
    return this.handlers.get(tabUrl);
  }
}

interface WebSocketClient {
  id: string,
  socket: WebSocket,
  bus: Evt<WsTask>
}

interface WsTaskRequest {
  requestId: string,
  request: DenotaskRequest
}

interface WsTaskResponse {
  requestId: string,
  response: DenotaskResponse
}

interface WsLifeCycleEvent {
  type: 'OPEN' | 'CLOSE'
}

type WsTask = WsTaskRequest | WsTaskResponse | WsLifeCycleEvent;

export async function sendReceiveTask(server: WebSocketServer, taskUrl: string, clientId: string, denotaskRequest: DenotaskRequest) {
  const requestId = crypto.randomUUID();

  const denotaskResponse = await new Promise<WsTaskResponse>((resolve, reject) => {
    console.log('HANDLING', taskUrl, requestId);
    const request: WsTaskRequest = {
      requestId: requestId,
      request: denotaskRequest
    };
    server.sendToClient(clientId, request);

    const ctx = server.onClientMessage(clientId, (data: WsTaskResponse) => {
      console.log(`tabHandler for requestId ${requestId}:  got a response`, data);
      console.log(data.requestId, requestId);
      console.log(`ctx`, ctx);
      if (data.requestId !== requestId) return;
      console.log(`tabHandler got a response for requestId ${requestId}:`, data.response);
      (ctx as Ctx<void>).done();
      clearTimeout(timeout);
      resolve(data);
    });

    // TODO should we return erros as json?
    const timeout = setTimeout(() => {
      console.log('Listener timeout:', taskUrl, requestId);
      const error = new Error('No response received from upstream handler.');
      (ctx as Ctx<void>).abort(error);
      reject({
        status: HttpStatus.MISSDIRECTED_REQUEST,
        payload: error.message
      });
    }, 5000);
  });

  return denotaskResponse;
}
