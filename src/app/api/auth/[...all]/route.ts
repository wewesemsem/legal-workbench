import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/modules/auth/auth";

/**
 * Better Auth native handler for session internals.
 * Application code should prefer the explicit REST wrappers:
 * /api/auth/register|login|logout|me
 */
export const { GET, POST } = toNextJsHandler(auth);
