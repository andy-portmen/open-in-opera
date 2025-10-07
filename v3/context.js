const lazyOpen = async tabs => {
  const prefs = await chrome.storage.local.get({
    multiple: false
  });
  if (prefs.multiple) {
    return open(tabs.map(t => t.url), tabs.map(t => t.id));
  }

  for (const {url, id} of tabs) {
    open([url], [id]);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
};

{
  const startup = () => {
    if (startup.done) {
      return;
    }
    startup.done = true;

    chrome.contextMenus.create({
      id: 'open-current',
      title: 'Open Link in Opera Browser',
      contexts: ['link'],
      documentUrlPatterns: ['*://*/*']
    }, () => chrome.runtime.lastError);
    chrome.contextMenus.create({
      id: 'open-all',
      title: 'Open all Tabs in Opera Browser',
      contexts: ['action']
    }, () => chrome.runtime.lastError);
    chrome.contextMenus.create({
      id: 'open-call',
      title: 'Open all Tabs in Opera Browser (Current window)',
      contexts: ['action']
    }, () => chrome.runtime.lastError);

    if (navigator.userAgent.includes('Firefox')) {
      chrome.contextMenus.create({
        id: 'open-options',
        title: 'Options',
        contexts: ['action']
      }, () => chrome.runtime.lastError);
    }
  };
  chrome.runtime.onStartup.addListener(startup);
  chrome.runtime.onInstalled.addListener(startup);
}

const oncontext = d => {
  if (d.menuItemId === 'open-options') {
    chrome.runtime.openOptionsPage();
  }
  else if (d.menuItemId === 'open-current') {
    open([d.linkUrl || d.pageUrl], []);
  }
  else if (d.menuItemId === 'open-all') {
    chrome.tabs.query({
      url: ['*://*/*']
    }, lazyOpen);
  }
  else if (d.menuItemId === 'open-call') {
    chrome.tabs.query({
      url: ['*://*/*'],
      currentWindow: true
    }, lazyOpen);
  }
};
chrome.contextMenus.onClicked.addListener(oncontext);
