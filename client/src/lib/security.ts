const isProduction = import.meta.env.PROD;

const noop = () => {};

function disableConsole() {
  if (!isProduction) return;
  
  const consoleMethods: (keyof Console)[] = [
    'log', 'debug', 'info', 'warn', 'error', 'table', 'trace', 
    'dir', 'dirxml', 'group', 'groupEnd', 'time', 'timeEnd', 
    'count', 'assert', 'profile', 'profileEnd'
  ];
  
  consoleMethods.forEach(method => {
    try {
      (window.console as any)[method] = noop;
    } catch (e) {}
  });
  
  try {
    Object.defineProperty(window, 'console', {
      value: new Proxy(console, {
        get: () => noop
      }),
      writable: false,
      configurable: false
    });
  } catch (e) {}
}

function preventDevTools() {
  if (!isProduction) return;
  
  document.addEventListener('keydown', (e) => {
    if (
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
      (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) ||
      (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) ||
      (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
    ) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, { capture: true });
  
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });
}

function antiDebug() {
  if (!isProduction) return;
  
  const checkDebugger = () => {
    const start = performance.now();
    debugger;
    const end = performance.now();
    if (end - start > 100) {
      document.body.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;"><p>Acesso não autorizado detectado.</p></div>';
    }
  };
  
  setInterval(checkDebugger, 5000);
}

function disableDevToolsDetection() {
  if (!isProduction) return;
  
  let devtoolsOpen = false;
  const threshold = 160;
  
  const checkDevTools = () => {
    const widthThreshold = window.outerWidth - window.innerWidth > threshold;
    const heightThreshold = window.outerHeight - window.innerHeight > threshold;
    
    if (widthThreshold || heightThreshold) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
      }
    } else {
      devtoolsOpen = false;
    }
  };
  
  setInterval(checkDevTools, 1000);
}

function protectGlobalObjects() {
  if (!isProduction) return;
  
  const protectedObjects = ['fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage'];
  
  protectedObjects.forEach(objName => {
    try {
      const original = (window as any)[objName];
      Object.defineProperty(window, objName, {
        get: () => original,
        set: () => {},
        configurable: false
      });
    } catch (e) {}
  });
}

function disableSourceMaps() {
  if (!isProduction) return;
  
  try {
    Object.defineProperty(Error.prototype, 'stack', {
      get: () => '',
      set: () => {},
      configurable: false
    });
  } catch (e) {}
}

export function initSecurity() {
  if (!isProduction) {
    return;
  }
  
  try {
    disableConsole();
    preventDevTools();
    protectGlobalObjects();
    disableSourceMaps();
  } catch (e) {}
}

export function initAntiDebug() {
  if (!isProduction) {
    return;
  }
  
  try {
    antiDebug();
    disableDevToolsDetection();
  } catch (e) {}
}
