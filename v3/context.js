const lazyOpen = tabs => {
  console.log(tabs.map(t => t.url));
  chrome.storage.local.get({
    multiple: false
  }, prefs => {
    if (prefs.multiple) {
      return open(tabs.map(t => t.url), tabs.map(t => t.id));
    }
    const tab = tabs.shift();
    if (tab) {
      open([tab.url], [tab.id]);
      setTimeout(lazyOpen, 1000, tabs);
    }
  });
};

{
  const startup = () => {
    chrome.contextMenus.create({
      id: 'open-current',
      title: 'Open Link in Opera Browser',
      contexts: ['link'],
      documentUrlPatterns: ['*://*/*']
    });
    chrome.contextMenus.create({
      id: 'open-all',
      title: 'Open all Tabs in Opera Browser',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: 'open-call',
      title: 'Open all Tabs in Opera Browser (Current window)',
      contexts: ['action']
    });
  };
  chrome.runtime.onStartup.addListener(startup);
  chrome.runtime.onInstalled.addListener(startup);
}

const oncontext = d => {
  if (d.menuItemId === 'open-current') {
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
