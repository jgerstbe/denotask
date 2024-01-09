import { Env, serveListener } from "./deps.ts";
import { startWss } from './wss.ts';
import { DenotaskRequest, HttpMethod } from "./types.ts";
import { handleLocalTask } from './taskHandler.ts';

await Env({ export: true });
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

  if (isTaskUrl) return handleLocalTask(wss, denotaskRequest, LOCAL_TASK_DIR, taskUrl);

  return new Response();
});
