import { CWD, handleRequest } from "../../handler.ts";
import { DenotaskRequest, HttpStatus, SimpleDenotaskResponse } from "../../types.ts";
import * as o from "https://deno.land/x/cowsay@1.1/mod.ts"
handleRequest(async (request: DenotaskRequest): Promise<SimpleDenotaskResponse> => {
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
    ${cowsay}
    ${new Date().getTime()}
    ${files.join(', ')}
  `;
  return {
    mime: 'text/plain',
    status: HttpStatus.OK,
    payload,
  };
});
