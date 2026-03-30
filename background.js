// DesignPrompt — Background Service Worker

// Open side panel when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Element/image picker results — relay to side panel
  if (message.type === 'ELEMENT_PICKED') {
    chrome.runtime.sendMessage({ type: 'ELEMENT_PICKED', data: message.data }).catch(() => {});
  }

  if (message.type === 'IMAGE_PICKED') {
    chrome.runtime.sendMessage({ type: 'IMAGE_PICKED', data: message.data }).catch(() => {});
  }

  if (message.type === 'PICKER_CANCELLED') {
    chrome.runtime.sendMessage({ type: 'PICKER_CANCELLED' }).catch(() => {});
  }
});
