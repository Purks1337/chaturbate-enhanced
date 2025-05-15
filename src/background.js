// Constants
const GITHUB_REPO = 'Purks1337/chaturbate-enhanced';
const UPDATE_CHECK_INTERVAL = 1000 * 60 * 60; // Check every hour

// Check for updates
function checkForUpdates() {
  fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
    .then(response => response.json())
    .then(data => {
      const currentVersion = chrome.runtime.getManifest().version;
      const latestVersion = data.tag_name.replace('v', '');
      
      if (latestVersion > currentVersion) {
        chrome.storage.local.set({ updateAvailable: true, updateUrl: data.html_url });
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
      }
    })
    .catch(error => console.error('Error checking for updates:', error));
}

// Initialize update checking
chrome.runtime.onInstalled.addListener(() => {
  checkForUpdates();
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL);
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSettings') {
        chrome.storage.sync.get({
            translationEnabled: true,
            blockerEnabled: true,
            statbateEnabled: true,
            tipInfoEnabled: true
        }, (items) => {
            sendResponse(items);
        });
        return true;
    }
    
    if (request.action === 'fetchStatbateData') {
        fetch(request.url)
            .then(response => response.text())
            .then(html => {
                sendResponse({ success: true, html: html });
            })
            .catch(error => {
                console.error('Error fetching Statbate data:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
}); 