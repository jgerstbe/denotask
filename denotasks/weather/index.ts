import { handleRequest  } from "../../handler.ts";
import { DenotaskRequest, HttpStatus } from "../../types.ts";
handleRequest(async (request: DenotaskRequest) => {
  const lat = request.url.searchParams.get('lat');
  const long = request.url.searchParams.get('long');
  if (!lat || !long) return {
    status: HttpStatus.BAD_REQUEST,
    payload: {
      error: {
        code: HttpStatus.BAD_REQUEST,
        message: 'The query parameters lat and long need to be set.'
      }
    }
  }
  try {
    const url = `https://api.open-meteo.com/v1/metno?latitude=${lat}&longitude=${long}&current=temperature_2m,relativehumidity_2m,apparent_temperature,rain&forecast_days=1`;
    const weatherData = await(await fetch(url)).json();
    return {
      status: HttpStatus.OK,
      payload: weatherData
    }
  } catch(error) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      payload: error
    }
  }
  
});
