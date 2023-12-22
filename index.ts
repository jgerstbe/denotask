import { WebSocketClient, Env, resolve, serveListener } from "./deps.ts";
import { startWss, registerChannel } from './wss.ts';
import { DenotaskRequest, DenotaskResponse, HttpMethod, HttpStatus } from "./types.ts";

await Env({export: true});
const HOSTNAME = Deno.env.get('HOSTNAME') || '127.0.0.1';
const PORT = Number(Deno.env.get('PORT')) || 4505;
const WS_HOSTNAME = Deno.env.get('WS_HOSTNAME') || '127.0.0.1';
const WS_PORT = Number(Deno.env.get('WS_PORT')) || 4506;
const FUNCTIONS_SUBDOMAIN = Deno.env.get('FUNCTIONS_SUBDOMAIN') || 's';
const LOCAL_TASK_DIR = Deno.env.get('LOCAL_TASK_DIR') || 'examples';

const wss = startWss(WS_PORT, WS_HOSTNAME);
const listener = Deno.listen({ hostname: HOSTNAME, port: PORT });
console.log(`Denotask server is running on http://${HOSTNAME}:${PORT}/ and ws://${WS_HOSTNAME}:${WS_PORT}`);

await serveListener(listener, async (request) => {
  const url = new URL(request.url);
  const path = decodeURIComponent(url.pathname);
  const taskUrl = decodeURIComponent(url.host.split('.')[0]);
  const isTaskUrl = url.host.split('.')[1] === FUNCTIONS_SUBDOMAIN;
  console.log('Got taskUrl and path:', taskUrl, path);

  if (!isTaskUrl) return new Response('Not a denotask subdomain.', { status: 400 });

  const denotaskRequest:DenotaskRequest = {
    body: request.body ? await request.json() : undefined,
    url,
    headers: request.headers,
    method: request.method as HttpMethod
  }

  try {
    const scriptFolderPath = `${Deno.cwd()}/${LOCAL_TASK_DIR}/${taskUrl}`;
    const libScriptPath = `${Deno.cwd()}/handler.ts`;
    const typesPath = `${Deno.cwd()}/types.ts`;
    const scriptPath = resolve(`${scriptFolderPath}/index.ts`);
    const fileInfo = await Deno.stat(scriptPath);
    if (!fileInfo.isFile) return new Response('Not Found', { status: 404 });

    let denotaskResponse: DenotaskResponse = {
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
        wssChannel
      ],
    });

    const { code, stdout, stderr } = await command.output();
    const decoder = new TextDecoder();
    console.log('code', code);
    console.log('stout', decoder.decode(stdout));
    console.error('stderr', decoder.decode(stderr));

    client.close();
    wss.channels.delete(wssChannel);

    let contentType = 'text/html';
    if (typeof(denotaskResponse.payload) !== 'string') {
      contentType = "application/json";
      denotaskResponse.payload = JSON.stringify(denotaskResponse.payload);
    };
    console.log('denotaskResponse.payload', denotaskResponse.payload);

    return new Response(denotaskResponse.payload as undefined, { 
      status: denotaskResponse.status,
      headers: {
        "Content-Type": contentType
      }
    });
  } catch (error) {
    console.error(error);
    return new Response('Internal Server Error', { status: 500 });
  }
});
