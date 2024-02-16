import { Ctx, resolve } from "./deps.ts";
import { ClientConnectionEvent, WebSocketServer } from "./WebSocketServer.ts";
import { DenotaskRequest, HttpStatus, SimpleDenotaskResponse, WsTaskResponse } from "./types.ts";

export async function handleLocalTask(wss: WebSocketServer, denotaskRequest: DenotaskRequest, LOCAL_TASK_DIR: string, taskUrl: string) {
    try {
        const scriptFolderPath = resolve(Deno.cwd(), LOCAL_TASK_DIR, taskUrl);
        const libScriptPath = resolve(Deno.cwd(), 'handler.ts');
        const typesPath = resolve(Deno.cwd(), 'types.ts');
        let scriptPath = resolve(scriptFolderPath, 'index.ts');
        try {
          const fileInfo = await Deno.stat(scriptPath);
          if (!fileInfo.isFile) return new Response('Not Found', { status: 404 });
        } catch {
          scriptPath = resolve(scriptFolderPath, 'index.js');
          const fileInfo = await Deno.stat(scriptPath);
          if (!fileInfo.isFile) return new Response('Not Found', { status: 404 })
        }
    
        let denotaskResponse: SimpleDenotaskResponse = {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          payload: 'No message received.'
        };
        
        const { clientId, key } = wss.announceClient();
        const requestId = crypto.randomUUID();
        const taskPromise = new Promise<void>((res, rej) => {
          const ctx = wss.onClientEvent((data: ClientConnectionEvent) => {
            console.log(`Server got a ClientConnectionEvent, waiting for ${clientId}, got:`, data);
            if (data.clientId !== clientId) return;          
            console.log('GOT MATCHHHH', requestId);
            const responseCtx = wss.onClientMessage(clientId, (response: WsTaskResponse) => {
              console.log('asdljkasjdlas', response)
              if (response.requestId !== requestId) return;
              denotaskResponse = response.response;
              (responseCtx as Ctx<void>).done();
              (ctx as Ctx<void>).done();
              clearTimeout(timeout);
              res();
            });
            wss.sendToClient(clientId, {
              id: requestId,
              request: denotaskRequest
            });

            // TODO should we return erros as json?
            const timeout = setTimeout(() => {
              console.log('Listener timeout:', taskUrl, requestId);
              (responseCtx as Ctx<void>).done();
              (ctx as Ctx<void>).done();
              rej();
            }, 5000);
          });
        });
    
        const command = new Deno.Command('deno', {
          args: [
            'run',
            '--allow-net',
            `--allow-read=${scriptFolderPath},${libScriptPath},${typesPath}`,
            scriptPath,
            clientId,
            key,
            wss.host,
            scriptFolderPath
          ],
        });

        const [ _, {code, stdout, stderr}] = await Promise.all([taskPromise, command.output()]);

        const decoder = new TextDecoder();
        console.log('code', code);
        console.log('stout', decoder.decode(stdout));
        console.error('stderr', decoder.decode(stderr));
    
        if (typeof(denotaskResponse.payload) !== 'string') {
          denotaskResponse.mime = "application/json";
          denotaskResponse.payload = JSON.stringify(denotaskResponse.payload);
        };
        console.log('denotaskResponse.payload', denotaskResponse.payload);
    
        return new Response(denotaskResponse.payload as undefined, { 
          status: denotaskResponse.status,
          headers: {
            "Content-Type": denotaskResponse.mime || 'text/html',
            "X-DENOTASK-TRACE-ID": requestId
          }
        });
      } catch (error) {
        console.error(error);
        return new Response('Internal Server Error', { status: 500 });
      }
}
