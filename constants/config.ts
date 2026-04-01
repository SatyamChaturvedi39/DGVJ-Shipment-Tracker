const DEV = __DEV__;

export const Config = {
  API_BASE_URL: DEV ? 'http://localhost:8000' : 'https://api.digvijayblr.com',
  DEV_MOCK_AUTH: DEV,
  DEV_ROLE_SELECTOR: DEV,
};
