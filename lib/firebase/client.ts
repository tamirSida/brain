"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from "firebase/auth";

import { firebaseConfig } from "./config";

/**
 * Firebase Auth in the browser.
 *
 * Local persistence so a phone that was signed in yesterday is still signed in
 * today — the SDK holds the refresh token and mints fresh ID tokens, which is
 * what keeps the server cookie renewable without ever storing a password.
 */
let auth: Auth | null = null;

export function firebaseAuth(): Auth {
  if (auth) return auth;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Fire and forget: persistence is a preference, and failing to set it should
  // not stop someone signing in.
  void setPersistence(auth, browserLocalPersistence).catch(() => {});
  return auth;
}
