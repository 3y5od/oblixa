import { NextRequest } from "next/server";

/** Helpers for colocated `route.test.ts` handlers (Epic 4 — maximal assurance program). */
export function apiGET(url: string, headers?: HeadersInit): NextRequest {
  return new NextRequest(url, { method: "GET", headers });
}

export function apiPOST(url: string, body?: BodyInit | null, headers?: HeadersInit): NextRequest {
  return new NextRequest(url, { method: "POST", body: body ?? null, headers });
}
