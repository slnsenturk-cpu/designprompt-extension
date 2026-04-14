// VibeDesign — Background Service Worker

// Open side panel when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Picker results flow through chrome.storage.local (dp_pending) — no relay needed
