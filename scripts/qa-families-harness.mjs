/**
 * Starts isolated Next.js + Laravel servers against the Firebase Auth emulator,
 * then runs scripts/qa-families-e2e.mjs.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const QA_PORT = process.env.QA_PORT ?? "3099";
const API_PORT = process.env.QA_API_PORT ?? "8099";
const emulatorHost =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

const demoFirebaseEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-familytask.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-familytask",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-familytask.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789012",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789012:web:demo",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: emulatorHost,
  NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${API_PORT}`,
};

const children = [];

function startProc(label, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  child.stdout?.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });
  children.push(child);
  return child;
}

async function waitFor(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function stopChildren() {
  for (const child of children) {
    child.kill("SIGTERM");
  }
}

function runAndWait(label, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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

async function main() {
  console.log(`Firebase Auth emulator: ${emulatorHost}`);
  console.log("Building Next.js for QA emulator run...");
  await runAndWait("clean", "rm", ["-rf", ".next"], { cwd: root });
  await runAndWait("build", "npm", ["run", "build"], {
    cwd: root,
    env: { ...process.env, ...demoFirebaseEnv },
  });

  startProc("next", "npx", ["next", "start", "-p", QA_PORT], {
    cwd: root,
    env: { ...process.env, ...demoFirebaseEnv },
  });
  await waitFor(`http://127.0.0.1:${QA_PORT}/login`);

  startProc(
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
      env: {
        ...process.env,
        FIREBASE_AUTH_EMULATOR_HOST: emulatorHost,
        FIREBASE_PROJECT_ID: "demo-familytask",
        BROADCAST_CONNECTION: "log",
      },
    },
  );
  await waitFor(`http://127.0.0.1:${API_PORT}/api/health`);
  await new Promise((resolve) => setTimeout(resolve, 3000));

  return new Promise((resolve) => {
    const qa = spawn("node", ["scripts/qa-families-e2e.mjs"], {
      cwd: root,
      env: {
        ...process.env,
        QA_BASE_URL: `http://127.0.0.1:${QA_PORT}`,
        QA_API_BASE_URL: `http://127.0.0.1:${API_PORT}`,
        FIREBASE_AUTH_EMULATOR_HOST: emulatorHost,
      },
      stdio: "inherit",
    });
    qa.on("close", (code) => resolve(code ?? 1));
  });
}

let exitCode = 1;

try {
  exitCode = await main();
} finally {
  stopChildren();
}

process.exit(exitCode);
