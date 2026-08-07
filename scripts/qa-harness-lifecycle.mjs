/**
 * Process / port lifecycle helpers for QA harnesses.
 */
import { execSync, spawn } from "node:child_process";

export function pidsOnPort(port) {
  try {
    const output = execSync(`lsof -ti:${port} 2>/dev/null || true`, {
      encoding: "utf8",
    }).trim();
    if (!output) return [];
    return output
      .split("\n")
      .map((value) => Number(value.trim()))
      .filter((pid) => Number.isFinite(pid) && pid > 0);
  } catch {
    return [];
  }
}

export async function killPorts(ports) {
  for (const port of ports) {
    for (const pid of pidsOnPort(port)) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // already exited
      }
    }
  }
}

export async function isPortInUse(port) {
  return pidsOnPort(port).length > 0;
}

export async function assertPortsFree(ports, label = "QA") {
  const blocked = [];
  for (const port of ports) {
    if (await isPortInUse(port)) {
      blocked.push(port);
    }
  }
  if (blocked.length > 0) {
    console.warn(`[${label}] ports still in use: ${blocked.join(", ")}`);
    return false;
  }
  console.log(`[${label}] ports free: ${ports.join(", ")}`);
  return true;
}

export function trackProcess(children, label, command, args, options = {}) {
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

export async function stopManagedProcesses(children, graceMs = 3000) {
  if (children.length === 0) return;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  await new Promise((resolve) => setTimeout(resolve, graceMs));

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGKILL");
    }
  }
}
