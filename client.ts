const ws=new WebSocket('ws://localhost/ws?bearerToken=helloiamhere');
ws.onopen=()=>ws.send(JSON.stringify({
  "type": "registerHandler",
  "tab": "hello"
}));
ws.onmessage=(m)=>{
    try {
      const { requestId, request } = JSON.parse(m.data);
      const name = getName(request.url);
      console.log('Got message', requestId, request, name);
      return ws.send(JSON.stringify({
        requestId,
        response: {
          mime: 'text/plain',
          status: 200,
          payload: 'hello from the ws client ' + name + ' ' + requestId
        }
      }));
    } catch {
      console.log('could not parse message', m.data);
    }
}
ws.onclose=()=>console.log('Exited');

function getName(url: string) {
  const u = new URL(url);
  return u.searchParams.get('name');
}
