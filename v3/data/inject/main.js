{
  let port;
  try {
    port = document.getElementById('hb-kl-rc-oi');
    port.remove();
  }
  catch (e) {
    port = document.createElement('span');
    port.id = 'hb-kl-rc-oi';
    document.documentElement.append(port);
  }

  const listen = e => {
    const s = document.createElement('script');
    s.textContent = listen.script;
    s.evt = e;
    try { // Firefox
      s.wrappedJSObject.evt = e;
    }
    catch (e) {}
    document.documentElement.append(s);
    s.remove();
    port.dispatchEvent(new CustomEvent('command', {
      detail: {
        ...s.dataset
      }
    }));
  };
  port.addEventListener('add-or-remove', e => {
    listen.script = e.detail;
    removeEventListener('click', listen, true);
    if (listen.script) {
      addEventListener('click', listen, true);
    }
  });
}
