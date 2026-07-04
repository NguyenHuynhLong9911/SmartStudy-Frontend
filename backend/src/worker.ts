import "dotenv/config";

console.log(
  JSON.stringify({
    event: "worker_started",
    service: "smartstudy-worker",
  }),
);

const keepAlive = setInterval(() => undefined, 60_000);

function stop(signal: NodeJS.Signals): void {
  console.log(JSON.stringify({ event: "worker_stopping", signal }));
  clearInterval(keepAlive);
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
