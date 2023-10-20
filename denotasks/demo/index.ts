import { handleRequest  } from "../../handler.ts";
import { DenotaskRequest, HttpStatus } from "../../types.ts";
handleRequest(async (request: DenotaskRequest) => {
  // await new Promise(resolve => setTimeout(resolve, 1000));
  const name = request.url.searchParams.get('name');
  const payload = `Hi <strong>${name}</strong> at ${new Date().getTime()}`;
  return {
    status: HttpStatus.OK,
    payload
  }
});
