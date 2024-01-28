import { Env, serveListener } from "./deps.ts";
import { startWss } from './wss.ts';
import { DenotaskRequest, HttpMethod } from "./types.ts";
import { handleLocalTask } from './handleTask.ts';
import { handleTabTask } from "./handleTab.ts";
import { WebSocketServer } from "./WebSocketServer.ts";

await Env({ export: true });
const HOSTNAME = Deno.env.get('HOSTNAME') || '127.0.0.1';
const PORT = Number(Deno.env.get('PORT')) || 4505;
const WS_HOSTNAME = Deno.env.get('WS_HOSTNAME') || '127.0.0.1';
const WS_PORT = Number(Deno.env.get('WS_PORT')) || 4506;
const FUNCTIONS_SUBDOMAIN = Deno.env.get('FUNCTIONS_SUBDOMAIN') || 's';
const TAB_SUBDOMAIN = 'tab';
const LOCAL_TASK_DIR = Deno.env.get('LOCAL_TASK_DIR') || 'examples';

const ipcWs = startWss(WS_PORT, WS_HOSTNAME);
const listener = Deno.listen({ hostname: HOSTNAME, port: PORT });
console.log(`Denotask server is running on http://${HOSTNAME}:${PORT}/ and ws://${WS_HOSTNAME}:${WS_PORT}`);

const WSS = new WebSocketServer();

await serveListener(listener, async (request) => {
  const url = new URL(request.url);
  const path = decodeURIComponent(url.pathname);
  const taskUrl = decodeURIComponent(url.host.split('.')[0]);
  const isRootUrl = url.host.split('.')[0] === FUNCTIONS_SUBDOMAIN; //TODO sollte ich hier die komplette baseUrl testen?
  const isWsUrl = isRootUrl && path === '/ws';
  const isTaskUrl = url.host.split('.')[1] === FUNCTIONS_SUBDOMAIN;
  const isTabUrl = url.host.split('.')[1] === TAB_SUBDOMAIN;
  console.log('request', url, isWsUrl)
  if (!isTaskUrl && !isTabUrl && !isWsUrl) return new Response('Not a denotask/tab subdomain.', { status: 404 });

  console.log(`Got ${taskUrl ? 'taskUrl' : 'tabUrl'} and path: ${taskUrl}, ${path}`);
  const denotaskRequest:DenotaskRequest = {
    body: request.body ? await request.json() : undefined,
    url,
    headers: request.headers,
    method: request.method as HttpMethod
  }

  if (isTaskUrl) return handleLocalTask(ipcWs, denotaskRequest, LOCAL_TASK_DIR, taskUrl);
  if (isTabUrl) return handleTabTask(WSS, denotaskRequest, taskUrl);

  const authResponse = bearerAuth(denotaskRequest, ['helloiamhere']);
  if (authResponse) return authResponse;
  if (isWsUrl) return WSS.upgradeAndHandleWs(request);

  return new Response(null, { status: 500 });
});

function bearerAuth(denotaskRequest: DenotaskRequest, tokens: string[]) {
  let authToken;
  try {
    authToken = denotaskRequest.headers.get('Authorization')!.split(' ')[1]
  } catch {
    authToken = denotaskRequest.url.searchParams.get('bearerToken');
  }
  if (!authToken) return new Response('Missing Authorization.', { status: 401 });
  if (!tokens.includes(authToken)) return new Response(null, { status: 403 });
}
