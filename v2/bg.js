'use strict';

const os = {
  mac: navigator.userAgent.indexOf('Mac') !== -1,
  linux: navigator.userAgent.indexOf('Linux') !== -1
};

const app = {
  id: 'com.add0n.node', // the node-js native component
  runtime: {
    mac: {
      args: ['-a', 'opera']
    },
    linux: {
      name: 'opera'
    },
    windows: {
      name: 'cmd',
      args: ['/s/c', 'start', 'opera "%url;"'],
      prgfiles: '%ProgramFiles%\\Opera\\launcher.exe'
    }
  }
};

function error(response) {
  alert(`Link transfer failed due to an error:

-----
Error Code: ${response.code}

stdout: ${response.stdout}

stderr: ${response.stderr}`);
}

function response(res, success = () => {}) {
  // windows batch file returns 1
  if (res && (res.code !== 0 && (res.code !== 1 || res.stderr !== ''))) {
    error(res);
  }
  else if (!res) {
    chrome.tabs.query({
      url: chrome.runtime.getURL('/opera-helper/index.html')
    }, tabs => {
      if (tabs && tabs.length) {
        const tab = tabs[0];
        chrome.tabs.update(tab.id, {
          active: true
        }, () => {
          chrome.windows.update(tab.windowId, {
            focused: true
          });
        });
      }
      else {
        chrome.tabs.create({
          url: '/opera-helper/index.html'
        });
      }
    });
  }
  else {
    success();
  }
}

// try to locale Opera browser
const locate = cb => chrome.runtime.sendNativeMessage(app.id, {
  cmd: 'env'
}, res => {
  if (res && res.env && res.env.ProgramFiles) {
    chrome.storage.local.set({
      path: app.runtime.windows.prgfiles
        .replace('%LOCALAPPDATA%', res.env.LOCALAPPDATA)
        .replace('%ProgramFiles(x86)%', res.env['ProgramFiles(x86)'])
        .replace('%ProgramFiles%', res.env.ProgramFiles)
    }, cb);
  }
  else {
    response(res);
  }
});

const exec = (command, args, callback, properties = {}) => {
  if (command) {
    chrome.runtime.sendNativeMessage(app.id, {
      cmd: 'exec',
      command,
      arguments: args,
      properties
    }, res => (callback || response)(res));
  }
  else {
    alert('Please set the browser path on the options page and retry.');
    chrome.runtime.openOptionsPage();
  }
};

const open = (urls, cids = []) => { // close ids
  chrome.storage.local.get({
    path: null,
    closeme: false
  }, prefs => {
    const close = () => {
      if (prefs.closeme && cids.length) {
        chrome.tabs.remove(cids);
      }
    };
    if (os.mac) {
      if (prefs.path) {
        const length = app.runtime.mac.args.length;
        app.runtime.mac.args[length - 1] = prefs.path;
      }
      exec('open', [...app.runtime.mac.args, ...urls], r => response(r, close));
    }
    else if (os.linux) {
      exec(prefs.path || app.runtime.linux.name, urls, r => response(r, close));
    }
    else {
      if (prefs.path) {
        exec(prefs.path, [...(app.runtime.windows.args2 || []), ...urls], r => response(r, close));
      }
      else {
        // Firefox is not detaching the process on Windows
        const args = app.runtime.windows.args
          .map(a => a.replace('%url;', urls.join(' ')))
          .map(s => s.replace('start', navigator.userAgent.indexOf('Firefox') !== -1 ? 'start /WAIT' : 'start'));
        const extra = {
          windowsVerbatimArguments: true
        };
        exec(app.runtime.windows.name, args, res => {
          // use old method
          if (res && res.code !== 0) {
            locate(() => open(urls, cids));
          }
          else {
            response(res, close);
          }
        }, extra);
      }
    }
  });
};

const onmessage = (request, {tab}) => {
  if (request.cmd === 'open-in') {
    open([request.url], [tab.id]);
  }
};
chrome.runtime.onMessage.addListener(onmessage);

const lazyOpen = tabs => {
  chrome.storage.local.get({
    multiple: true
  }, prefs => {
    if (prefs.multiple) {
      return open(tabs.map(t => t.url), tabs.map(t => t.id));
    }
    const tab = tabs.shift();
    if (tab) {
      open([tab.url], [tab.id]);
      window.setTimeout(lazyOpen, 1000, tabs);
    }
  });
};

const onclick = () => chrome.tabs.query(onclick.args, tabs => open(tabs.map(t => t.url), tabs.map(t => t.id)));
onclick.args = {
  active: true,
  currentWindow: true
};
chrome.browserAction.onClicked.addListener(onclick);

// context menu
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
      contexts: ['browser_action']
    });
    chrome.contextMenus.create({
      id: 'open-call',
      title: 'Open all Tabs in Opera Browser (Current window)',
      contexts: ['browser_action']
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

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.create({
              url: page + '&version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install'
            });
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '&rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
