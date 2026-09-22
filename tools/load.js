/* ブラウザのグローバル <script> 読み込みを再現する検証用ローダー */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function loadGame(files) {
  const sandbox = {
    console,
    Math, Date, JSON, Object, Array, String, Number, Boolean, Error, RegExp, Map, Set,
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: (() => {
      let store = {};
      return {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; },
        clear: () => { store = {}; },
      };
    })(),
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {}, remove() {} }),
      addEventListener: () => {},
      body: { appendChild() {} },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  for (const f of files) {
    const full = path.join(ROOT, f);
    const code = fs.readFileSync(full, 'utf8');
    try {
      vm.runInContext(code, ctx, { filename: f });
    } catch (e) {
      throw new Error(`[${f}] ${e.message}\n${e.stack.split('\n').slice(0, 4).join('\n')}`);
    }
  }
  return ctx.G;
}

/* index.html の <script src> 順をそのまま読む */
function scriptsFromIndex() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
}

module.exports = { loadGame, scriptsFromIndex, ROOT };
