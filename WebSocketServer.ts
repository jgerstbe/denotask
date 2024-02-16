import { Ctx, Evt } from "./deps.ts";
import { DenotaskRequest, DenotaskResponse, HttpStatus } from "./types.ts";
import { z } from './deps.ts';

const clientConnectionEvent = z.object({
  clientId: z.string(),
  type: z.union([z.literal('CONNECTED'), z.literal('DISCONNECTED')]),
});

export type ClientConnectionEvent = z.infer<typeof clientConnectionEvent>;

export class WebSocketServer {
  private clients: Map<string, WebSocketClient> = new Map();
  // Map<tabPrefix, clientId>
  private handlers: Map<string, string> = new Map();
  // Map<uuid, key>
  private clientRegistrationList: Map<string, string> = new Map();
  readonly clientEventBus = Evt.create<ClientConnectionEvent>();
  readonly host: string;

  constructor(host: string) {
    this.host = host;
  }

  private addClient(socket: WebSocket, uuid?: string): WebSocketClient {
    if (!uuid) uuid = crypto.randomUUID();
    if (this.clients.has(uuid)) throw new Error('This UUID already exists!');
    const bus = Evt.create<WsTask>();
    const wsc: WebSocketClient = {
      id: uuid,
      socket,
      bus
    };
    this.clients.set(uuid, wsc);
    socket.onopen = () => this.sendClientConnectedEvent(uuid!);
    return wsc;
  }

  private sendClientConnectedEvent(uuid: string) {
    console.log(`Sending connected event for client ${uuid}.`);
    this.clientEventBus.post({
      clientId: uuid,
      type: 'CONNECTED'
    });
  }

  private removeClient(uuid: string) {
    this.handlers.forEach((value, key) => {
        if(value === uuid){
          console.log(`Removed client ${uuid} as handler for ${key}`);
          this.handlers.delete(key);
        }
    });
    this.clientEventBus.post({
      clientId: uuid,
      type: 'DISCONNECTED'
    });
    this.clients.delete(uuid);
  }

  // deno-lint-ignore no-explicit-any
  public onClientEvent(callback: any) {
    const ctx = Evt.newCtx();
    this.clientEventBus.attach(ctx, callback);
    return ctx;
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

  public upgradeAndHandleIpc(request: Request, clientId: string, key:string) {
    const announcementKey = this.clientRegistrationList.get(clientId);
    if (!announcementKey) throw Error(`ClientId ${clientId} was not announced.`);
    const isNotAuthenticated = announcementKey !== key;
    if (isNotAuthenticated) throw Error(`Authentication failed for clientId ${clientId}.`);
    
    this.clientRegistrationList.delete(clientId);
    const { response, socket } = Deno.upgradeWebSocket(request);
    const client = this.addClient(socket, clientId);
    client.socket.onmessage = ev => {
      let messageBody: WsTask;
      try {
        messageBody = JSON.parse(ev.data);
        // i can not use the returned value here at the moment as the custom request/response object will be empty
        // therefore i still use messageBody
        WsTaskSchema.parse(messageBody);
        console.log(`[IPC] Got message from ${client.id}:`, messageBody);
      } catch {
        const msg = `[${client.id}] Error while parsing messageBody: ${ev.data}`;
        client.socket.send(msg);
        return console.error(msg);
      }
      client.bus.post(messageBody);
    }
    client.socket.onclose = closed => {
      console.log(`[IPC] WS client connection closed for: ${client.id} with Code/Reason ${closed.code} ${closed.reason}`);
      client.bus.post({ type: 'CLOSE' });
      this.removeClient(client.id);
    }
    return response;
  }

  private attachClientHandler(client: WebSocketClient) {
    client.socket.onopen = () => {
      console.log(`WS client connection opend for: ${client.id}`);
      client.socket.send(`You are Client ${client.id}`);
      client.bus.post({ type: 'OPEN' });
    };
    client.socket.onmessage = ev => {
      let messageBody: WsTask;
      try {
        messageBody = JSON.parse(ev.data);
        // i can not use the returned value here at the moment as the custom request/response object will be empty
        // therefore i still use messageBody
        WsTaskSchema.parse(messageBody);
        console.log(`[TAB] Got message from ${client.id}:`, messageBody);
      } catch {
        const msg = `[${client.id}] Error while parsing messageBody: ${ev.data}`;
        client.socket.send(msg);
        return console.error(msg);
      }
      // register as tab handler
      const registering = WsRegisterTabHandlerSchema.safeParse(messageBody);
      if (registering.success) {
        // TODO check user rights
        if (this.handlers.has(registering.data.tab)) {
          const msg = `[${client.id}] a handler alredy exists for tab ${registering.data.tab}`;
          client.socket.send(msg);
          return console.error(msg);
        }
        const msg = `[${client.id}] Successfully set as handler for tab ${registering.data.tab}`;
        client.socket.send(msg);
        this.handlers.set(registering.data.tab, client.id);
        return;
      }
      client.bus.post(messageBody);
    };
    client.socket.onclose = closed => {
      console.log(`[TAB] WS client connection closed for: ${client.id} with Code/Reason ${closed.code} ${closed.reason}`);
      client.bus.post({ type: 'CLOSE' });
      this.removeClient(client.id);
    }
  }

  public announceClient() {
    const clientId = crypto.randomUUID();
    const key = crypto.randomUUID();
    this.clientRegistrationList.set(clientId, key);
    return { clientId, key };
  }

  public getHandlingClient(tabUrl: string) {
    return this.handlers.get(tabUrl);
  }
}

const WebSocketClient = z.object({
  id: z.string(),
  socket: z.custom<WebSocket>(),
  bus: z.custom<Evt<WsTask>>()
});

type WebSocketClient = z.infer<typeof WebSocketClient>;

const WsTaskRequestSchema = z.object({
  requestId: z.string(),
  request: z.custom<DenotaskRequest>() // TODO DenotaskRequestSchema;
});
type WsTaskRequest = z.infer<typeof WsTaskRequestSchema>;


const WsTaskResponseSchema = z.object({
  requestId: z.string(),
  response: z.custom<DenotaskResponse>() // DenotaskResponseSchema;
});
type WsTaskResponse = z.infer<typeof WsTaskResponseSchema>;

const WsLifeCycleEventSchema = z.object({
  type: z.union([z.literal('OPEN'), z.literal('CLOSE')]),
});
type WsLifeCycleEvent = z.infer<typeof WsLifeCycleEventSchema>;

const WsRegisterTabHandlerSchema = z.object({
  type: z.literal('registerHandler'),
  tab: z.string(),
});
type WsRegisterTabHandler = z.infer<typeof WsRegisterTabHandlerSchema>;

const WsTaskSchema = z.union([
  WsTaskRequestSchema,
  WsTaskResponseSchema,
  WsLifeCycleEventSchema,
  WsRegisterTabHandlerSchema,
]);
type WsTask = z.infer<typeof WsTaskSchema>;

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
