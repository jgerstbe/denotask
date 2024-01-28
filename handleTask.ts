import { WebSocketClient, resolve, WebSocketServer } from "./deps.ts";
import { deleteChannel, registerChannel } from './wss.ts';
import { DenotaskRequest, DenotaskResponse, HttpStatus } from "./types.ts";

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
    
        let denotaskResponse: DenotaskResponse = {
          mime: 'text/html',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          payload: 'No message received.'
        };
        const wssChannel = crypto.randomUUID();
        registerChannel(wss, wssChannel);
        const client = new WebSocketClient(wss.address);
        client.on(wssChannel, (event:unknown) => {
          if (event === 'pingpong') return client.to(wssChannel, denotaskRequest);
          console.log(`Server got a message!`, event);
          denotaskResponse = event as DenotaskResponse;
        });
    
        const command = new Deno.Command('deno', {
          args: [
            'run',
            '--allow-net',
            `--allow-read=${scriptFolderPath},${libScriptPath},${typesPath}`,
            scriptPath,
            wss.address,
            wssChannel,
            scriptFolderPath
          ],
        });
    
        const { code, stdout, stderr } = await command.output();
        const decoder = new TextDecoder();
        console.log('code', code);
        console.log('stout', decoder.decode(stdout));
        console.error('stderr', decoder.decode(stderr));
    
        client.close();
        deleteChannel(wss, wssChannel);
    
        if (typeof(denotaskResponse.payload) !== 'string') {
          denotaskResponse.mime = "application/json";
          denotaskResponse.payload = JSON.stringify(denotaskResponse.payload);
        };
        console.log('denotaskResponse.payload', denotaskResponse.payload);
    
        return new Response(denotaskResponse.payload as undefined, { 
          status: denotaskResponse.status,
          headers: {
            "Content-Type": denotaskResponse.mime
          }
        });
      } catch (error) {
        console.error(error);
        return new Response('Internal Server Error', { status: 500 });
      }
}
