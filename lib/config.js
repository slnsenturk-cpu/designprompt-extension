// VibeDesign — auth config (v2.0.0-beta.1)
// Plain globals so the same file works via importScripts (service worker)
// and via <script> tag (sidepanel). No ESM, no build step.

var VD_CONFIG = {
  SUPABASE_URL: 'https://murywrqvssymvehwkjjh.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cnl3cnF2c3N5bXZlaHdrampoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODQwNjUsImV4cCI6MjA4NzM2MDA2NX0.CiLcLs3_4xJ5m4BjNDqzJaxCFCcvMKiTt1cOp0Yoi60',
  WEB_AUTH_BASE: 'https://vibedesign.tech',
  PRODUCTION_EXTENSION_ID: 'peajencpkpgmidiooahoibfbhbjboobl',
  AUTH_STORAGE_KEY: 'auth_session',
  REFRESH_ALARM_NAME: 'refresh_token',
  REFRESH_ALARM_PERIOD_MIN: 50,
  REFRESH_LEEWAY_MS: 10 * 60 * 1000
};

if (typeof self !== 'undefined') {
  self.VD_CONFIG = VD_CONFIG;
}
