const DEV = __DEV__;

// EXPO_PUBLIC_DEV_MOCK_AUTH=false  → disables OTP bypass even in Expo Go (use for real-device testing)
// EXPO_PUBLIC_API_URL              → override backend URL (required when testing on a physical device)
const mockAuthEnv = process.env.EXPO_PUBLIC_DEV_MOCK_AUTH;
const mockAuthEnabled = DEV && mockAuthEnv !== 'false';

export const Config = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL ?? (DEV ? 'http://localhost:8000' : 'https://api.digvijayblr.com'),
  DEV_MOCK_AUTH: mockAuthEnabled,
  DEV_ROLE_SELECTOR: mockAuthEnabled,
};
