'use strict';

if (typeof importScripts !== 'undefined') {
  self.importScripts('context.js');
}

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
      prgfiles: '%LocalAppData%\\Programs\\Opera\\launcher.exe'
    }
  }
};

const error = async title => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  chrome.action.setBadgeText({
    tabId: tab.id,
    text: 'E'
  });
  chrome.action.setBadgeBackgroundColor({
    tabId: tab.id,
    color: 'red'
  });
  chrome.action.setTitle({
    tabId: tab.id,
    title
  });
  chrome.tabs.sendMessage(tab.id, {
    method: 'notify',
    message: title
  }).catch(() => {});
};

async function response(res, success = () => {}) {
  // windows batch file returns 1
  if (res && (res.code !== 0 && (res.code !== 1 || res.stderr !== ''))) {
    console.warn(res);
    error(`Link transfer failed due to the following error

[code]   ${res.code}
[stdout] ${res.stdout || '-'}
[stderr] ${res.stderr || '-'}`);
  }
  else if (!res) {
    const tabs = await chrome.tabs.query({
      url: chrome.runtime.getURL('/opera-helper/index.html')
    });
    if (tabs && tabs.length) {
      const tab = tabs[0];
      chrome.tabs.update(tab.id, {
        active: true
      });
      chrome.windows.update(tab.windowId, {
        focused: true
      });
    }
    else {
      chrome.tabs.create({
        url: '/opera-helper/index.html'
      });
    }
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
        .replace(/%localappdata%/ig, res.env.LOCALAPPDATA)
        .replace(/%programfiles\(x86\)%/ig, res.env['ProgramFiles(x86)'])
        .replace(/%programfiles%/ig, res.env.ProgramFiles)
    }, cb);
  }
  else {
    response(res);
  }
});

const exec = (command, args, callback, properties = {}) => {
  if (command) {
    console.info('[native]', command, args);

    chrome.runtime.sendNativeMessage(app.id, {
      cmd: 'exec',
      command,
      arguments: args,
      properties
    }, res => (callback || response)(res));
  }
  else {
    error('Please set the browser path on the options page and retry.');
    chrome.runtime.openOptionsPage();
  }
};

const open = async (urls, cids = []) => { // close ids
  const prefs = await chrome.storage.local.get({
    path: null,
    closeme: false
  });
  const close = () => {
    if (prefs.closeme && cids.length) {
      chrome.tabs.remove(cids);
    }
  };
  // Mac
  if (navigator.userAgent.indexOf('Mac') !== -1) {
    if (prefs.path) {
      const length = app.runtime.mac.args.length;
      app.runtime.mac.args[length - 1] = prefs.path;
    }
    exec('open', [...app.runtime.mac.args, ...urls], r => response(r, close));
  }
  // Linux
  else if (navigator.userAgent.indexOf('Linux') !== -1) {
    exec(prefs.path || app.runtime.linux.name, urls, r => response(r, close));
  }
  // Windows
  else {
    if (prefs.path) {
      exec(prefs.path, [...(app.runtime.windows.args2 || []), ...urls], r => response(r, close));
    }
    else {
      // Firefox is not detaching the process on Windows
      const args = [...app.runtime.windows.args];
      args[1] = args[1].replace('start', navigator.userAgent.indexOf('Firefox') !== -1 ? 'start /WAIT' : 'start');
      args[2] = args[2].replace('%url;', urls.join(' '));

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
};

chrome.runtime.onMessage.addListener((request, {tab}) => {
  if (request.cmd === 'open-in') {
    open([request.url], [tab.id]);
  }
  if (request.cmd === 'open-in' && request.close) {
    chrome.tabs.remove(tab.id);
  }
});

const onclick = () => chrome.tabs.query(onclick.args, tabs => open(tabs.map(t => t.url), tabs.map(t => t.id)));
onclick.args = {
  active: true,
  currentWindow: true
};
chrome.action.onClicked.addListener(onclick);

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
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '&version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '&rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
