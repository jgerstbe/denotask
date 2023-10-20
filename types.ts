export type HttpMethod = 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE';

export enum HttpStatus {
    OK = 200,
    CREATED = 201,
    ACCEPTED = 202,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    METHOD_NOT_ALLOWED = 405,
    INTERNAL_SERVER_ERROR = 500,
}

export type DenotaskRequest = {
    body: unknown,
    url: URL,
    headers: Headers,
    method: HttpMethod
}

export type DenotaskResponse = {
    status: HttpStatus,
    payload: unknown
}

export type Callback = (request: DenotaskRequest) => Promise<DenotaskResponse>;
