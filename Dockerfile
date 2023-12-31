FROM denoland/deno:alpine-1.37.2

# The port that your application listens to.
ARG PORT=4505
EXPOSE $PORT

WORKDIR /app

# Prefer not to run as root.
USER deno

# Cache the dependencies as a layer (the following two steps are re-run only when deps.ts is modified).
# Ideally cache deps.ts will download and compile _all_ external files used in main.ts.
COPY deps.ts .
RUN deno cache deps.ts

# These steps will be re-run upon each file change in your working directory:
COPY . .
# Compile the main app so that it doesn"t need to be compiled each startup/entry.
RUN deno cache index.ts

CMD ["deno", "run", "--allow-net", "--allow-read=./", "--allow-run=deno", "--allow-env=HOSTNAME,PORT,WS_HOSTNAME,WS_PORT,FUNCTIONS_SUBDOMAIN,LOCAL_TASK_DIR", "index.ts"]
