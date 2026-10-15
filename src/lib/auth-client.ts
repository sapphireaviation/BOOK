"use client";
import { createAuthClient } from "better-auth/react";
import { magicLinkClient, inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    inferAdditionalFields({ user: { role: { type: "string", required: false }, phone: { type: "string", required: false } } }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
