/**
 * Starts Next.js + Laravel + Reverb for realtime sync QA.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeRunId,
  waitForHttpOk,
  warmupBackendAuth,
} from "./qa-harness-utils.mjs";
import {
  assertPortsFree,
  killPorts,
  stopManagedProcesses,
  trackProcess,
} from "./qa-harness-lifecycle.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const QA_PORT = process.env.QA_PORT ?? "3097";
const API_PORT = process.env.QA_API_PORT ?? "8097";
const REVERB_PORT = process.env.QA_REVERB_PORT ?? "8087";
const MANAGED_PORTS = [Number(QA_PORT), Number(API_PORT), Number(REVERB_PORT)];
const emulatorHost =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

const REVERB_APP_ID = process.env.QA_REVERB_APP_ID ?? "1001";
const REVERB_APP_KEY = process.env.QA_REVERB_APP_KEY ?? "qa-reverb-key";
const REVERB_APP_SECRET = process.env.QA_REVERB_APP_SECRET ?? "qa-reverb-secret";

const demoFirebaseEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-familytask.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-familytask",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-familytask.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789012",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789012:web:demo",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: emulatorHost,
  NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${API_PORT}`,
  NEXT_PUBLIC_REVERB_APP_KEY: REVERB_APP_KEY,
  NEXT_PUBLIC_REVERB_HOST: "127.0.0.1",
  NEXT_PUBLIC_REVERB_PORT: REVERB_PORT,
  NEXT_PUBLIC_REVERB_SCHEME: "http",
};

const laravelEnv = {
  FIREBASE_AUTH_EMULATOR_HOST: emulatorHost,
  FIREBASE_PROJECT_ID: "demo-familytask",
  BROADCAST_CONNECTION: "reverb",
  REVERB_APP_ID,
  REVERB_APP_KEY,
  REVERB_APP_SECRET,
  REVERB_HOST: "127.0.0.1",
  REVERB_PORT,
  REVERB_SCHEME: "http",
  REVERB_SERVER_PORT: REVERB_PORT,
};

const children = [];

function runAndWait(label, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = trackProcess([], label, command, args, {
      stdio: "inherit",
      ...options,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${code}`));
    });
  });
}

async function waitForReverb(port, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const net = await import("node:net");
      await new Promise((resolve, reject) => {
        const socket = net.connect({ host: "127.0.0.1", port: Number(port) });
        socket.once("connect", () => {
          socket.end();
          resolve();
        });
        socket.once("error", reject);
      });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Timed out waiting for Reverb on port ${port}`);
}

async function main() {
  console.log(`Firebase Auth emulator: ${emulatorHost}`);
  await killPorts(MANAGED_PORTS);

  console.log("Building Next.js for QA realtime run...");
  await runAndWait("build", "npm", ["run", "build"], {
    cwd: root,
    env: { ...process.env, ...demoFirebaseEnv },
  });

  console.log(`Starting Reverb on ws://127.0.0.1:${REVERB_PORT}`);
  trackProcess(children, "reverb", "php", ["artisan", "reverb:start"], {
    cwd: path.join(root, "api"),
    env: { ...process.env, ...laravelEnv },
  });
  await waitForReverb(REVERB_PORT);

  console.log(`Starting Laravel on http://127.0.0.1:${API_PORT}`);
  trackProcess(
    children,
    "laravel",
    "php",
    [
      "-d",
      "max_execution_time=0",
      "artisan",
      "serve",
      `--host=127.0.0.1`,
      `--port=${API_PORT}`,
    ],
    {
      cwd: path.join(root, "api"),
      env: { ...process.env, ...laravelEnv },
    },
  );
  await waitForHttpOk(`http://127.0.0.1:${API_PORT}/api/health`);
  await warmupBackendAuth({
    apiBase: `http://127.0.0.1:${API_PORT}`,
    emulatorHost,
  });

  console.log(`Starting Next.js on http://127.0.0.1:${QA_PORT}`);
  trackProcess(children, "next", "npx", ["next", "start", "-p", QA_PORT], {
    cwd: root,
    env: { ...process.env, ...demoFirebaseEnv },
  });
  await waitForHttpOk(`http://127.0.0.1:${QA_PORT}/login`);

  const runId = makeRunId("qa-realtime");
  console.log(`QA runId: ${runId}`);

  return new Promise((resolve) => {
    const qa = trackProcess(
      children,
      "qa",
      "node",
      ["scripts/qa-realtime-e2e.mjs"],
      {
        cwd: root,
        env: {
          ...process.env,
          QA_BASE_URL: `http://127.0.0.1:${QA_PORT}`,
          QA_API_BASE_URL: `http://127.0.0.1:${API_PORT}`,
          QA_REVERB_PORT: REVERB_PORT,
          QA_RUN_ID: runId,
          FIREBASE_AUTH_EMULATOR_HOST: emulatorHost,
        },
        stdio: "inherit",
      },
    );
    qa.on("close", (code) => resolve(code ?? 1));
  });
}

let exitCode = 1;

try {
  await assertPortsFree(MANAGED_PORTS, "qa-realtime-harness");
  exitCode = await main();
} finally {
  await stopManagedProcesses(children, MANAGED_PORTS);
}

process.exit(exitCode);
