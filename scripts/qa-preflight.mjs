/**
 * Clears stale QA / emulator ports before firebase emulators:exec starts.
 */
import { assertPortsFree, killPorts } from "./qa-harness-lifecycle.mjs";

const PORTS = [9099, 3098, 3099, 8098, 8099];

await killPorts(PORTS);
await assertPortsFree(PORTS, "qa-preflight");
