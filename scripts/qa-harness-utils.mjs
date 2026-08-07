/**
 * Shared helpers for Firebase Auth Emulator + Laravel QA harnesses.
 */

const DEFAULT_PASSWORD = process.env.QA_FIREBASE_PASSWORD ?? "qa-password-123456";

export function makeRunId(prefix = "qa") {
  const fromEnv = process.env.QA_RUN_ID;
  if (fromEnv) return fromEnv;
  return `${prefix}-${Date.now()}`;
}

export function qaEmail(runId, label) {
  return `${runId}-${label}@example.com`.replace(/[^a-zA-Z0-9@._-]/g, "-");
}

export async function waitForHttpOk(url, timeoutMs = 120_000) {
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

async function emulatorAuthRequest(emulatorHost, path, body) {
  const [host, port] = emulatorHost.split(":");
  const url = `http://${host}:${port}/identitytoolkit.googleapis.com/v1/${path}?key=demo-api-key`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

export async function emulatorSignUp(email, password, emulatorHost) {
  const result = await emulatorAuthRequest(emulatorHost, "accounts:signUp", {
    email,
    password,
    returnSecureToken: true,
  });
  if (!result.ok && result.payload?.error?.message !== "EMAIL_EXISTS") {
    throw new Error(
      `Emulator signUp failed for ${email}: ${result.payload?.error?.message ?? result.status}`,
    );
  }
}

export async function getEmulatorIdToken(
  email,
  password = DEFAULT_PASSWORD,
  emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099",
  options = {},
) {
  const { createIfMissing = false } = options;

  if (createIfMissing) {
    await emulatorSignUp(email, password, emulatorHost).catch(() => {});
  }

  const result = await emulatorAuthRequest(
    emulatorHost,
    "accounts:signInWithPassword",
    { email, password, returnSecureToken: true },
  );

  if (!result.ok) {
    if (createIfMissing) {
      await emulatorSignUp(email, password, emulatorHost);
      return getEmulatorIdToken(email, password, emulatorHost, {
        createIfMissing: false,
      });
    }
    throw new Error(
      `Emulator sign-in failed for ${email}: ${result.payload?.error?.message ?? result.status}`,
    );
  }

  return result.payload.idToken;
}

/**
 * Verifies Laravel can verify Auth Emulator tokens before browser QA starts.
 */
export async function warmupBackendAuth({
  apiBase,
  emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099",
  maxAttempts = 40,
} = {}) {
  if (!apiBase) {
    throw new Error("warmupBackendAuth requires apiBase");
  }

  const warmupEmail = `qa-warmup-${Date.now()}@example.com`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await waitForHttpOk(`${apiBase}/api/health`, 5_000);
      const token = await getEmulatorIdToken(warmupEmail, DEFAULT_PASSWORD, emulatorHost, {
        createIfMissing: true,
      });
      const response = await fetch(`${apiBase}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (response.ok) {
        console.log(`Backend auth warmup succeeded (attempt ${attempt})`);
        return;
      }
      console.warn(
        `[warmup] auth/me returned ${response.status} (attempt ${attempt})`,
      );
    } catch (error) {
      console.warn(
        `[warmup] attempt ${attempt} failed: ${error instanceof Error ? error.message : error}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Backend auth warmup failed after maximum attempts");
}

export function logApiResult(label, method, path, result) {
  const safeBody =
    result.body && typeof result.body === "object"
      ? JSON.stringify(result.body).slice(0, 200)
      : String(result.body ?? "").slice(0, 200);
  console.log(
    `[api] ${label} ${method} ${path} → ${result.status}${safeBody ? ` ${safeBody}` : ""}`,
  );
}

export async function apiFetch(apiBase, token, path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: response.ok, status: response.status, body };
}
