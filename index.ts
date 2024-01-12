import { Env, serveListener } from "./deps.ts";
import { startWss } from './wss.ts';
import { DenotaskRequest, HttpMethod } from "./types.ts";
import { handleLocalTask } from './taskHandler.ts';
import { handleTabTask } from "./tabHandler.ts";

await Env({ export: true });
const HOSTNAME = Deno.env.get('HOSTNAME') || '127.0.0.1';
const PORT = Number(Deno.env.get('PORT')) || 4505;
const WS_HOSTNAME = Deno.env.get('WS_HOSTNAME') || '127.0.0.1';
const WS_PORT = Number(Deno.env.get('WS_PORT')) || 4506;
const FUNCTIONS_SUBDOMAIN = Deno.env.get('FUNCTIONS_SUBDOMAIN') || 's';
const TAB_SUBDOMAIN = 'tab';
const LOCAL_TASK_DIR = Deno.env.get('LOCAL_TASK_DIR') || 'examples';

const ipcWs = startWss(WS_PORT, WS_HOSTNAME);
const externalIpcWs = startWss(4507, '0.0.0.0');
const listener = Deno.listen({ hostname: HOSTNAME, port: PORT });
console.log(`Denotask server is running on http://${HOSTNAME}:${PORT}/ and ws://${WS_HOSTNAME}:${WS_PORT}`);

externalIpcWs.on("connect", (e) => {
  console.log('A client has connected!', e.detail.id);
  externalIpcWs.to('connect', `Your are client ${e.detail.id}`, e.detail.id);
});

await serveListener(listener, async (request) => {
  const url = new URL(request.url);
  const path = decodeURIComponent(url.pathname);
  const taskUrl = decodeURIComponent(url.host.split('.')[0]);
  const isTaskUrl = url.host.split('.')[1] === FUNCTIONS_SUBDOMAIN;
  const isTabUrl = url.host.split('.')[1] === TAB_SUBDOMAIN;

  if (!isTaskUrl && !isTabUrl) return new Response('Not a denotask/tab subdomain.', { status: 404 });

  console.log(`Got ${taskUrl ? 'taskUrl' : 'tabUrl'} and path: ${taskUrl}, ${path}`);
  const denotaskRequest:DenotaskRequest = {
    body: request.body ? await request.json() : undefined,
    url,
    headers: request.headers,
    method: request.method as HttpMethod
  }

  if (isTaskUrl) return handleLocalTask(ipcWs, denotaskRequest, LOCAL_TASK_DIR, taskUrl);
  if (isTabUrl) return handleTabTask(externalIpcWs, denotaskRequest, taskUrl);

  return new Response();
});
