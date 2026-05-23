import { describe, expect, it } from "vitest";
import { mapAuthError, mapDataSourceError } from "./user-facing";

describe("mapDataSourceError", () => {
  it("maps duplicate / unique constraint to a safe message", () => {
    expect(mapDataSourceError("duplicate key value violates unique constraint")).toBe(
      "That value is already in use. Try something different."
    );
    expect(mapDataSourceError("UNIQUE constraint failed")).toBe(
      "That value is already in use. Try something different."
    );
    expect(mapDataSourceError("already exists")).toBe(
      "That value is already in use. Try something different."
    );
  });

  it("maps foreign key errors to a generic retry message", () => {
    expect(mapDataSourceError("violates foreign key constraint")).toBe(
      "This action could not be completed. Refresh the page and try again."
    );
    expect(mapDataSourceError("referential integrity")).toBe(
      "This action could not be completed. Refresh the page and try again."
    );
  });

  it("maps RLS / permission errors", () => {
    expect(mapDataSourceError("permission denied for table x")).toBe(
      "You do not have permission to do that."
    );
    expect(mapDataSourceError("new row violates RLS policy")).toBe(
      "You do not have permission to do that."
    );
  });

  it("maps JWT / session hints", () => {
    expect(mapDataSourceError("invalid JWT")).toBe("Your session expired. Sign in again.");
    expect(mapDataSourceError("session expired")).toBe("Your session expired. Sign in again.");
  });

  it("replaces long or technical dumps", () => {
    expect(mapDataSourceError("x".repeat(200))).toBe("Something went wrong. Please try again.");
    expect(mapDataSourceError("Error in node_modules/foo")).toBe(
      "Something went wrong. Please try again."
    );
    expect(mapDataSourceError("TypeError: undefined is not a function")).toBe(
      "Something went wrong. Please try again."
    );
    expect(mapDataSourceError("oops\n    at foo (bar.js:1:1)")).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("returns generic message for short benign messages", () => {
    expect(mapDataSourceError("Not found")).toBe("An unexpected error occurred. Please try again.");
  });
});

describe("mapAuthError", () => {
  it("maps known auth messages", () => {
    expect(mapAuthError("Invalid login credentials")).toBe("Invalid email or password.");
    expect(mapAuthError("Email not confirmed")).toBe("Confirm your email before signing in.");
    expect(mapAuthError("User already registered")).toBe("An account with this email already exists.");
    expect(mapAuthError("redirect_uri is not allowed")).toBe(
      "This site URL is not allowed for auth redirects. Add it in Supabase under Authentication → URL Configuration."
    );
    expect(mapAuthError("Rate limit exceeded")).toBe(
      "Too many attempts. Wait a few minutes and try again."
    );
  });

  it("maps transient auth provider failures to a clear retry message", () => {
    expect(mapAuthError("{}")).toBe(
      "Authentication is temporarily unavailable. Try again in a few minutes."
    );
    expect(mapAuthError("fetch failed")).toBe(
      "Authentication is temporarily unavailable. Try again in a few minutes."
    );
    expect(mapAuthError("upstream returned 522")).toBe(
      "Authentication is temporarily unavailable. Try again in a few minutes."
    );
    expect(mapAuthError({ message: "service unavailable", status: 522, name: "AuthRetryableFetchError" })).toBe(
      "Authentication is temporarily unavailable. Try again in a few minutes."
    );
  });

  it("routes password-related errors through mapDataSourceError", () => {
    expect(mapAuthError("Password should be at least 8 characters")).toBe(
      mapDataSourceError("Password should be at least 8 characters")
    );
  });
});
