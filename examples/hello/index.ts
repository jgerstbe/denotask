import { CWD, handleRequest } from "../../handler.ts";
import { DenotaskRequest, HttpStatus } from "../../types.ts";
import * as o from "https://deno.land/x/cowsay@1.1/mod.ts"
handleRequest(async (request: DenotaskRequest) => {
  const files = [];
  for await (const dirEntry of Deno.readDir(CWD)) {
    files.push(dirEntry.name);
  }
  const name = request.url.searchParams.get("name");
  const cowsay = o.say({
      text: 'hello '+name,
      wrap: true,
      wrapLength: 40,
  })
  const payload = `
    ${cowsay} <br>
    ${new Date().getTime()} <br>
    ${files.join(', ')}
  `;
  return {
    mime: 'text/plain',
    status: HttpStatus.OK,
    payload,
  };
});
