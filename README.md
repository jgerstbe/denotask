# denotask
Denotask is a poor mans deno edge runtime. It spins up a webserver using deno and matches a subdomain path with a local folder to execute a deno script inside that folder.
Thanks to the ["secure by default"]((https://deno.land/manual/basics/permissions)) deno runtime these user provided scripts can be executed with restricted permissions:
- `allow-net` to download deno packages and interact with external apis
- `allow-read` restricted to the folder containing the script and needed library files or the ipc between the server and the scripts deno process

The name is inspired by the shut down webtask.io service which was provided by auth0.

## Setup
- copy (and edit) the env file
    ```bash
    cp .env.example .env
    ```
- as the routing is based on subdmains you need to **setup a reverse proxy** or add the needed entries to your hostfile
    - http://weather.denotask.localhost:4505/?lat=59.91&long=10.75 would execute the script in `<project-path>/examples/weather/index.ts` with the default configuration
- run it with docker
    ```bash
    docker compose up
    ```
- or run it locally
    ```bash
    deno run --allow-net --allow-read="./" --allow-run="deno" --allow-env="HOSTNAME,PORT,WS_HOSTNAME,WS_PORT,FUNCTIONS_SUBDOMAIN,LOCAL_TASK_DIR" index.ts
    ```
