// src/config.ts

interface Config {
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  api: {
    jdScreenerUrl: string;
  };
}

// Helper to ensure env vars exist
const getEnv = (key: string): string => {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const config: Config = {
  firebase: {
    apiKey: getEnv("VITE_FIREBASE_API_KEY"),
    authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: getEnv("VITE_FIREBASE_APP_ID"),
  },
  api: {
    jdScreenerUrl: getEnv("VITE_JD_SCREENER_API_URL"),
  },
};
