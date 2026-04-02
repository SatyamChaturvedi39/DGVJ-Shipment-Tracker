const DEV = __DEV__;

// EXPO_PUBLIC_DEV_MOCK_AUTH=false  → disables OTP bypass even in Expo Go (use for real-device testing)
// EXPO_PUBLIC_API_URL              → override backend URL (required when testing on a physical device)
// EXPO_PUBLIC_WS_URL               → override WebSocket URL (defaults to API_BASE_URL with ws:// scheme)
const mockAuthEnv = process.env.EXPO_PUBLIC_DEV_MOCK_AUTH;
const mockAuthEnabled = DEV && mockAuthEnv !== 'false';

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? (DEV ? 'http://localhost:8000' : 'https://api.digvijayblr.com');

// Derive WS URL from API URL by replacing http(s):// with ws(s)://
const derivedWsUrl = apiUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');

export const Config = {
  API_BASE_URL: apiUrl,
  WS_BASE_URL: process.env.EXPO_PUBLIC_WS_URL ?? derivedWsUrl,
  DEV_MOCK_AUTH: mockAuthEnabled,
  DEV_ROLE_SELECTOR: mockAuthEnabled,
};
