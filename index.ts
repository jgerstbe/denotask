import { serveListener } from "https://deno.land/std@0.204.0/http/server.ts";
import { resolve } from "https://deno.land/std@0.204.0/path/mod.ts";
import { WebSocketClient, WebSocketServer } from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import { DenotaskRequest, DenotaskResponse, HttpMethod } from "./types.ts";


const PORT = 4505;
const FUNCTIONS_SUBDOMAIN = 's';

const listener = Deno.listen({ port: PORT });
console.log(`Deno server is running on http://localhost:${PORT}/`);

await serveListener(listener, async (request) => {
  const url = new URL(request.url);
  const path = decodeURIComponent(url.pathname);
  const taskUrl = decodeURIComponent(url.host.split('.')[0]);
  const isTaskUrl = url.host.split('.')[1] === FUNCTIONS_SUBDOMAIN;
  console.log('Got taskUrl and:', taskUrl, path);

  if (!isTaskUrl) return new Response('Not a denotask subdomain.', { status: 400 });

  const denotaskRequest:DenotaskRequest = {
    body: request.body ? await request.json() : undefined,
    url,
    headers: request.headers,
    method: request.method as HttpMethod
  }

  try {
    const taskDirName = 'denotasks';
    const scriptFolderPath = `${Deno.cwd()}/${taskDirName}/${taskUrl}`;
    const libScriptPath = `${Deno.cwd()}/handler.ts`;
    const typesPath = `${Deno.cwd()}/types.ts`;
    const scriptPath = resolve(`${scriptFolderPath}/index.ts`);
    const fileInfo = await Deno.stat(scriptPath);
    if (!fileInfo.isFile) return new Response('Not Found', { status: 404 });

    const wsPort = generateRandomPort();
    let lastMessage = '';
    console.log('wsPort', wsPort);
    const wss = new WebSocketServer(wsPort);
    wss.on("connection", function (ws: WebSocketClient) {
      console.log('Got connection');

      ws.send(JSON.stringify(denotaskRequest));

      ws.on("message", function (message: string) {
        console.log(message, typeof(message));
        lastMessage = message;
        ws.closeForce()
      });
    });

    console.warn('scriptPath', scriptPath);
    const command = new Deno.Command('deno', {
      args: [
        'run',
        '--allow-net',
        `--allow-read=${scriptFolderPath},${libScriptPath},${typesPath}`,
        scriptPath,
        `${wsPort}`
      ],
    });
    const { code, stdout, stderr } = await command.output();
    const decoder = new TextDecoder();
    console.log('code', code);
    console.log('stout', decoder.decode(stdout));
    console.error('stderr', decoder.decode(stderr));

    wss.close();

    console.log('lastMessage', lastMessage);
    const denotaskResponse = JSON.parse(lastMessage as unknown as string) as DenotaskResponse;
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

function generateRandomPort(): number {
  const minPort = 11112; // Minimum port number (11111 + 1)
  const maxPort = 65535; // Maximum port number

  // Generate a random number between minPort and maxPort
  const randomPort = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;

  return randomPort;
}
