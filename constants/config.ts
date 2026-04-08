const DEV = __DEV__;

// EXPO_PUBLIC_DEV_MOCK_AUTH=false    → disables OTP bypass even in Expo Go (use for real-device testing)
// EXPO_PUBLIC_API_URL                → dev backend URL (emulator: localhost:8000, physical device: LAN IP)
// EXPO_PUBLIC_PROD_API_URL           → production backend URL (e.g. https://digvijay-blr.onrender.com)
// EXPO_PUBLIC_WS_URL / _PROD_WS_URL  → override WebSocket URL (derived from API URL if not set)
const mockAuthEnv = process.env.EXPO_PUBLIC_DEV_MOCK_AUTH;
const mockAuthEnabled = DEV && mockAuthEnv !== 'false';

// In dev: read EXPO_PUBLIC_API_URL (defaults to localhost).
// In production build: read EXPO_PUBLIC_PROD_API_URL (must be set before running eas build).
const apiUrl = DEV
  ? (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000')
  : (process.env.EXPO_PUBLIC_PROD_API_URL ?? 'https://digvijay-blr-api.onrender.com');

// Derive WS URL from API URL by replacing http(s):// with ws(s)://
const derivedWsUrl = apiUrl.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');

export const Config = {
  API_BASE_URL: apiUrl,
  WS_BASE_URL: process.env.EXPO_PUBLIC_WS_URL ?? derivedWsUrl,
  DEV_MOCK_AUTH: mockAuthEnabled,
  DEV_ROLE_SELECTOR: mockAuthEnabled,
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? 'PLACEHOLDER',
};
