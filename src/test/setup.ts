// Test setup file for Vitest
// This file runs before each test file

import { vi } from "vitest";

// Mock Firebase modules BEFORE importing anything else
vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({
    name: "[DEFAULT]",
  })),
}));

vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
  })),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

// Mock config
vi.mock("@/config", () => ({
  config: {
    firebase: {
      apiKey: "test-api-key",
      authDomain: "test-auth-domain",
      projectId: "test-project-id",
    },
    api: {
      jdScreenerUrl: "https://test-api.example.com/jd-screener",
    },
  },
}));
