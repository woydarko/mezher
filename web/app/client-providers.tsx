"use client";

import dynamic from "next/dynamic";

// Passport's wallet libraries touch `document` at import time, so the wallet tree renders client-only.
export const ClientProviders = dynamic(() => import("./providers").then((m) => m.Providers), { ssr: false });
