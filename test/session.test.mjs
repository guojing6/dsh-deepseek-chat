// Exercises the Desktop session mirror: the two guest scripts that read and write
// the embedded page's storage, and the host-side snapshot they feed. The plugin is
// loaded through a stubbed application window, so no Electron or jsdom is needed.
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'

const SOURCE = new URL('../lib/client.js', import.meta.url)
const CHAT_ORIGIN = 'https://chat.deepseek.com'
const TOKEN = JSON.stringify({ value: 'tok-123', __version: '0' })

function storage(seed = {}) {
  const map = new Map(Object.entries(seed))
  return {
    get length() { return map.size },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(String(key), String(value)) },
    removeItem: (key) => { map.delete(key) },
    clear: () => { map.clear() },
  }
}

function cookieJar(initial = '') {
  const jar = new Map()
  for (const part of initial.split(';')) {
    const pair = part.trim()
    const at = pair.indexOf('=')
    if (at > 0) jar.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim())
  }
  return {
    get cookie() { return [...jar].map(([name, value]) => `${name}=${value}`).join('; ') },
    set cookie(value) {
      const pair = String(value).split(';')[0]
      const at = pair.indexOf('=')
      if (at > 0) jar.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim())
    },
  }
}

/** Run one guest script against a stubbed origin and return its completion value. */
function runGuest(script, localStorage, document) {
  const context = vm.createContext({ localStorage, document, JSON, Object, String, console })
  return vm.runInContext(script, context)
}

/** Load the plugin factory with a stubbed application window and expose its internals. */
function loadPlugin() {
  const source = readFileSync(SOURCE, 'utf8')
  const patched = source.replace(
    'return { apply };',
    'globalThis.__probe = { READ_STORAGE, writeStorageScript, readSession, writeSession, isChatUrl, isGuestPage, SESSION_KEY, SESSION_VERSION, CHAT_ORIGIN };\nreturn { apply };',
  )
  // Fail loudly if the factory's shape changes rather than passing on a stale probe.
  assert.notEqual(patched, source, 'could not expose the plugin internals for testing')

  const hostStorage = storage()
  const host = {
    window: {
      __ModuleLoader__: { load: (module) => { host.__factory = module.factory } },
      location: { protocol: 'dsh-app:' },
      setInterval: () => 0,
      clearInterval: () => {},
    },
    document: { documentElement: { dataset: {} } },
    localStorage: hostStorage,
    console,
    Date,
    JSON,
    Object,
    String,
  }
  vm.createContext(host)
  vm.runInContext(patched, host)
  assert.equal(typeof host.__factory, 'function', 'factory not captured')
  host.__factory()
  return { probe: host.__probe, hostStorage }
}

describe('guest storage snapshot', () => {
  it('keeps the sign-in entries and drops oversized caches', () => {
    const { probe } = loadPlugin()
    // The oversized cache comes first on purpose: it must not crowd out the small
    // entries that follow it.
    const guest = storage({
      __oversized_cache: 'x'.repeat(300000),
      userToken: TOKEN,
      __appKit_userInfo: '{"id":42}',
      theme: 'dark',
      __session_page_size__: '30',
    })
    const raw = runGuest(probe.READ_STORAGE, guest, cookieJar('readable=1'))
    assert.equal(typeof raw, 'string')
    const snapshot = JSON.parse(raw)
    assert.equal(snapshot.local.userToken, TOKEN)
    assert.equal(snapshot.local.__appKit_userInfo, '{"id":42}')
    assert.equal(snapshot.local.theme, 'dark')
    assert.equal(snapshot.local.__session_page_size__, '30')
    assert.equal(snapshot.cookies, 'readable=1')
    assert.ok(!('__oversized_cache' in snapshot.local), 'an oversized cache must not be carried')
    assert.ok(raw.length < 2000, `the snapshot must stay small, got ${raw.length}`)
  })

  it('reports unavailable storage instead of throwing', () => {
    const { probe } = loadPlugin()
    const guest = storage()
    Object.defineProperty(guest, 'length', { get() { throw new Error('denied') } })
    assert.equal(runGuest(probe.READ_STORAGE, guest, cookieJar()), '')
  })
})

describe('guest storage restore', () => {
  it('writes the snapshot back and reports the restored token', () => {
    const { probe } = loadPlugin()
    const fresh = storage()
    const document = cookieJar()
    const restored = runGuest(
      probe.writeStorageScript({ local: { userToken: TOKEN, theme: 'dark' }, cookies: 'readable=1' }),
      fresh,
      document,
    )
    assert.equal(restored, TOKEN)
    assert.equal(fresh.getItem('userToken'), TOKEN)
    assert.equal(fresh.getItem('theme'), 'dark')
    assert.equal(document.cookie, 'readable=1')
  })

  it('reports an empty token when the write is refused', () => {
    const { probe } = loadPlugin()
    const guest = storage()
    guest.setItem = () => { throw new Error('quota') }
    assert.equal(runGuest(probe.writeStorageScript({ local: { userToken: TOKEN }, cookies: '' }), guest, cookieJar()), '')
  })
})

describe('host-side snapshot', () => {
  it('round-trips a stored session', () => {
    const { probe } = loadPlugin()
    probe.writeSession({ version: probe.SESSION_VERSION, origin: CHAT_ORIGIN, savedAt: 1, local: { userToken: TOKEN }, cookies: 'readable=1' })
    const reloaded = probe.readSession()
    assert.ok(reloaded !== null)
    assert.equal(reloaded.local.userToken, TOKEN)
    assert.equal(reloaded.cookies, 'readable=1')
  })

  it('rejects a snapshot it cannot trust', () => {
    const { probe, hostStorage } = loadPlugin()
    const rejected = [
      { version: probe.SESSION_VERSION + 1, origin: CHAT_ORIGIN, local: {} },
      { version: probe.SESSION_VERSION, origin: 'https://example.com', local: {} },
      { version: probe.SESSION_VERSION, origin: CHAT_ORIGIN, local: null },
    ]
    for (const value of rejected) {
      hostStorage.setItem(probe.SESSION_KEY, JSON.stringify(value))
      assert.equal(probe.readSession(), null, `must reject ${JSON.stringify(value)}`)
    }
    hostStorage.setItem(probe.SESSION_KEY, 'not json')
    assert.equal(probe.readSession(), null, 'must reject corrupt storage')
    hostStorage.removeItem(probe.SESSION_KEY)
    assert.equal(probe.readSession(), null, 'must report a missing snapshot')
  })
})

describe('guest location', () => {
  it('separates the chat application from a page opened from a conversation', () => {
    const { probe } = loadPlugin()
    for (const url of [CHAT_ORIGIN + '/', CHAT_ORIGIN + '/a/chat/s/8f2', CHAT_ORIGIN + '/sign_in']) {
      assert.equal(probe.isChatUrl(url), true, `${url} is the application`)
      assert.equal(probe.isGuestPage(url), false, `${url} is the application, not another page`)
    }
    for (const url of ['https://example.com/article', 'https://chat.deepseek.com.evil.test/', 'http://chat.deepseek.com.other/']) {
      assert.equal(probe.isChatUrl(url), false, `${url} is not the application`)
      assert.equal(probe.isGuestPage(url), true, `${url} is a page the user opened from a conversation`)
    }
    for (const url of [CHAT_ORIGIN + '/robots.txt', 'about:blank#lease', 'dsh-app://app/', '', undefined]) {
      assert.equal(probe.isChatUrl(url), false, `${url} is not the chat interface`)
      assert.equal(probe.isGuestPage(url), false, `${url} is not a page the user opened either`)
    }
  })
})

/**
 * A DOM stand-in rich enough to activate the plugin. `brand` makes the sidebar title
 * findable, which is what turns the switcher on; `guestUrl` is what the stand-in guest
 * reports as its current page.
 *
 * The default tree mirrors the current shell: the renderer mounts the root occupant
 * through an outlet anchor, so it is `#root > div[data-slot="root"] (display:contents)
 * > frame`, and the frame is the grid container publishing the column solve.
 * `flattenRoot` mounts the frame directly under `#root` for the older shape.
 */
function fakeDom(options = {}) {
  const make = (tag) => {
    const attributes = new Map()
    const listeners = []
    const node = {
      tagName: tag.toUpperCase(),
      id: '',
      type: '',
      title: '',
      hidden: false,
      lang: '',
      style: {},
      children: [],
      parentElement: null,
      attributes,
      listeners,
      textContent: '',
      innerHTML: '',
      dataset: {},
      isConnected: true,
      computedStyle: null,
      rect: { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
      setAttribute(name, value) { attributes.set(name, String(value)) },
      removeAttribute(name) { attributes.delete(name) },
      getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null },
      appendChild(child) { this.children.push(child); child.parentElement = this; child.isConnected = true; return child },
      removeChild(child) { this.children = this.children.filter((entry) => entry !== child); child.parentElement = null },
      remove() {
        if (this.parentElement !== null) this.parentElement.removeChild(this)
        this.isConnected = false
      },
      addEventListener(type, listener) { listeners.push([type, listener]) },
      removeEventListener() {},
      contains: () => false,
      closest: () => null,
      querySelector(selector) {
        const needle = selector.startsWith('[class*="') && selector.endsWith('"]') ? selector.slice(9, -2) : null
        if (needle === null) return null
        const walk = (node) => {
          for (const child of node.children) {
            const classes = child.getAttribute('class')
            if (typeof classes === 'string' && classes.includes(needle)) return child
            const found = walk(child)
            if (found !== null) return found
          }
          return null
        }
        return walk(this)
      },
      get firstElementChild() { return this.children[0] ?? null },
      getBoundingClientRect() { return { ...this.rect } },
    }
    if (tag === 'webview') {
      // Electron answers every one of these only after the guest is attached and has
      // emitted dom-ready; the stand-in keeps that rule, so a test fails loudly when the
      // plugin reads the guest too early. Calls the plugin makes are recorded on
      // `options`, which the caller keeps.
      const expectReady = () => {
        if (options.guestReady !== true) {
          throw new Error('The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.')
        }
      }
      node.getURL = () => { expectReady(); return options.guestUrl ?? '' }
      node.canGoBack = () => { expectReady(); return options.canGoBack === true }
      node.goBack = () => { expectReady(); options.goBacks = (options.goBacks ?? 0) + 1 }
      node.loadURL = (url) => { expectReady(); (options.loads ??= []).push(url); return Promise.resolve() }
      node.setUserAgent = () => { expectReady() }
      node.executeJavaScript = () => { expectReady(); return Promise.resolve('') }
    }
    return node
  }
  // The shell's frame publishes its column solve on itself; the stand-in answers with
  // the same shape a computed style does (properties plus the two structural members
  // the plugin reads). The frame box and the main column box are what the view's
  // trailing edges are measured from, exactly like the rc.5 layout.
  const viewportWidth = options.viewportWidth ?? 1000
  const viewportHeight = options.viewportHeight ?? 700
  const sidebarWidth = options.sidebarWidth ?? 280
  const frame = make('div')
  frame.computedStyle = {
    display: 'grid',
    gridTemplateColumns: options.columns ?? '280px minmax(0px, 1fr) minmax(0px, 0px)',
    vars: {},
    getPropertyValue(name) { return this.vars[name] ?? '' },
  }
  frame.rect = { width: viewportWidth, height: viewportHeight, top: 0, left: 0, right: viewportWidth, bottom: viewportHeight }
  // The frame's first element child is the sidebar column, the measurement of last
  // resort when the host publishes no column solve.
  const sidebarColumn = make('div')
  sidebarColumn.rect = { width: sidebarWidth, height: viewportHeight, top: 0, left: 0, right: sidebarWidth, bottom: viewportHeight }
  frame.appendChild(sidebarColumn)
  // The main column: its right/bottom edges shrink when the right sidebar opens, which
  // is what keeps an In-App Browser tab beside the chat visible.
  const centerColumn = make('div')
  centerColumn.setAttribute('class', 'mP3x-q_centerCol')
  centerColumn.rect = {
    width: viewportWidth - sidebarWidth - (options.rightbarWidth ?? 0),
    height: viewportHeight - (options.bottomRowHeight ?? 0),
    top: 0,
    left: sidebarWidth,
    right: viewportWidth - (options.rightbarWidth ?? 0),
    bottom: viewportHeight - (options.bottomRowHeight ?? 0),
  }
  frame.appendChild(centerColumn)
  const root = make('div')
  root.id = 'root'
  // The renderer's outlet anchor: no layout box of its own, so it must never be
  // mistaken for the frame (it publishes no custom properties and no grid).
  const outlet = make('div')
  outlet.setAttribute('data-slot', 'root')
  outlet.computedStyle = { display: 'contents', gridTemplateColumns: 'none', vars: {}, getPropertyValue() { return '' } }
  if (options.flattenRoot === true) {
    root.appendChild(frame)
  } else {
    root.appendChild(outlet)
    outlet.appendChild(frame)
  }
  const state = { brandIdentity: null }
  const documentElement = make('html')
  documentElement.lang = options.lang ?? 'zh-CN'
  const documentListeners = new Map()
  const observers = []
  const dom = {
    document: {
      documentElement,
      head: make('head'),
      body: make('body'),
      createElement: make,
      getElementById: (id) => (id === 'root' ? root : null),
      querySelector: (selector) => (selector.includes('brandIdentity') ? state.brandIdentity : null),
      addEventListener: (type, listener) => { documentListeners.set(type, listener) },
      removeEventListener: (type) => { documentListeners.delete(type) },
    },
    frame,
    outlet,
    root,
    sidebarColumn,
    state,
    documentListeners,
    observers,
    make,
    centerColumn,
    // Mount a fresh sidebar title, the way the host appears to after the sidebar is
    // rebuilt or expanded again.
    mountBrand(parent = frame) {
      const identity = make('span')
      const button = make('button')
      identity.closest = (selector) => (selector === 'button' ? button : null)
      button.appendChild(identity)
      parent.appendChild(button)
      state.brandIdentity = identity
      dom.brandIdentity = identity
      dom.brandButton = button
      return { identity, button }
    },
    // Deliver the pending child-list mutations to the plugin's observers.
    flush() { for (const observer of observers) observer.callback() },
  }
  if (options.brand !== false) dom.mountBrand()
  return dom
}

/** Load the real source — no probe patch — against a DOM stand-in it can activate on. */
function loadForActivation(options = {}) {
  const source = readFileSync(SOURCE, 'utf8')
  const dom = fakeDom(options)
  const released = []
  const subscriptions = []
  const assigned = []
  const browser = {
    acquire: options.acquire ?? (() => Promise.resolve({ lease: 'lease-1', partition: 'partition-1' })),
    release: options.release ?? ((lease) => { released.push(lease); return Promise.resolve() }),
    onOpenRequested: options.onOpenRequested ?? ((lease, listener) => { subscriptions.push({ lease, listener }); return () => {} }),
  }
  const host = {
    window: {
      __ModuleLoader__: { load: (module) => { host.__factory = module.factory } },
      location: { protocol: options.protocol ?? 'dsh-app:', assign: (url) => { assigned.push(url) } },
      setInterval: () => 1,
      clearInterval: () => {},
      open: options.open ?? (() => null),
      dshDesktop: { browser },
    },
    document: dom.document,
    localStorage: storage(),
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' },
    // The plugin keeps one observer alive across the host's remounts, so the stand-in
    // records them and `flush()` replays the child-list callback.
    MutationObserver: class {
      constructor(callback) { this.callback = callback; dom.observers.push(this) }
      observe() {}
      disconnect() {}
    },
    getComputedStyle: (node) => node.computedStyle ?? { display: 'block', gridTemplateColumns: 'none', vars: {}, getPropertyValue: () => '' },
    console,
    Date,
    JSON,
    Object,
    String,
  }
  vm.createContext(host)
  vm.runInContext(source, host)
  assert.equal(typeof host.__factory, 'function', 'factory not captured')
  return { module: host.__factory(), dom, browser, released, subscriptions, assigned }
}

/** Run the plugin and open the view the way the sidebar title does. */
async function openView(options = {}) {
  // The stand-in guest records what the plugin does to it on this same object, so the
  // caller keeps the spies.
  options.brand = options.brand ?? true
  const { module, dom, released, subscriptions } = loadForActivation(options)
  module.apply({
    effect: (fn) => { fn(); return () => {} },
    get: (name) => options.services?.[name],
  })
  const click = dom.brandButton.listeners.find(([type]) => type === 'click')[1]
  click({ preventDefault() {}, stopImmediatePropagation() {} })
  // build() awaits the lease round trip before it reveals the view.
  await new Promise((resolve) => setImmediate(resolve))
  const host = dom.document.body.children.find((node) => node.id === 'dsh-chat-view')
  assert.ok(host, 'opening the view must attach its host')
  const back = host.children.find((node) => node.id === 'dsh-chat-view-back')
  assert.ok(back, 'the view must offer the round control')
  const guest = host.children.find((node) => node.tagName === 'WEBVIEW')
  assert.ok(guest, 'opening the view must attach its guest')
  const fire = (type, event = {}) => {
    for (const [name, listener] of [...guest.listeners]) if (name === type) listener(event)
  }
  return {
    dom,
    host,
    back,
    guest,
    options,
    released,
    subscriptions,
    clickControl: () => back.listeners.find(([type]) => type === 'click')[1]({}),
    // The guest attaches and boots, exactly as the real element reports it.
    ready: () => { options.guestReady = true; fire('dom-ready') },
    // The guest lands on another page, the way a link or a route change does.
    navigate: (url) => { options.guestUrl = url; fire('did-navigate') },
    // A guest load failure, the way the element reports one.
    failLoad: (event) => fire('did-fail-load', event),
  }
}

// Nothing else in this file calls `apply`, and that gap is how a fatal ReferenceError
// inside the activation path once shipped: the module loaded, every helper tested clean,
// and the plugin was dead on Desktop. These cases run the real source end to end.
describe('activation', () => {
  it('activates on desktop and hands the context a teardown', () => {
    const { module } = loadForActivation()
    let dispose = null
    const ctx = { effect: (fn) => { dispose = fn(); return () => {} } }
    assert.doesNotThrow(() => { module.apply(ctx) })
    assert.equal(typeof dispose, 'function', 'apply must give ctx.effect the teardown')
    assert.doesNotThrow(() => { dispose() })
  })

  it('binds the sidebar title and puts the chrome back on teardown', () => {
    const { module, dom } = loadForActivation({ brand: true })
    let dispose = null
    module.apply({ effect: (fn) => { dispose = fn(); return () => {} } })
    assert.equal(dom.brandButton.getAttribute('data-dsh-product-trigger'), '')
    assert.equal(dom.brandButton.getAttribute('aria-label'), '切换 DeepSeek Chat')
    assert.ok(dom.brandButton.listeners.some(([type]) => type === 'click'), 'the brand must answer clicks')
    assert.ok(dom.documentListeners.has('click'), 'the host-click guard must be watching')
    dispose()
    assert.equal(dom.brandButton.getAttribute('data-dsh-product-trigger'), null, 'teardown must restore the title')
    assert.equal(dom.documentListeners.has('click'), false, 'teardown must drop the host-click guard')
  })

  it('reveals the view on the first click, before the guest is ready', async () => {
    // The regression this guards: reading the fresh element's address in the reveal path
    // threw Electron's "must be attached … dom-ready" error, so the first click after a
    // launch handed the URL to the system browser and only the second click showed the view.
    const { host, back, options, clickControl } = await openView({ guestUrl: 'https://example.com/article', canGoBack: true })
    assert.equal(host.hidden, false, 'the first click must open the view, not the system browser')
    assert.equal(back.getAttribute('aria-label'), '返回 DeepSeek Harness', 'without a page there is nothing to go back to inside the view')
    assert.equal(options.goBacks, undefined, 'a guest that is not ready must not be asked anything')
    clickControl()
    assert.equal(host.hidden, true, 'the control keeps its plain meaning until the guest is ready')
  })

  it('returns to the conversation a page was opened from', async () => {
    const { host, back, options, ready, navigate, clickControl } = await openView({ canGoBack: true })
    ready()
    navigate('https://example.com/article')
    assert.equal(back.getAttribute('aria-label'), '返回 DeepSeek Chat', 'the control must say where it goes')
    clickControl()
    assert.equal(options.goBacks, 1, 'the guest must step back to the conversation it came from')
    assert.equal(host.hidden, false, 'the view stays up while the guest is away from the chat interface')
  })

  it('returns to the harness from the chat interface', async () => {
    const { host, back, options, ready, clickControl } = await openView({ guestUrl: CHAT_ORIGIN + '/a/chat/s/8f2' })
    ready()
    assert.equal(back.getAttribute('aria-label'), '返回 DeepSeek Harness', 'the control must say where it goes')
    clickControl()
    assert.equal(host.hidden, true, 'the chat interface has nothing to go back to inside the view')
    assert.equal(options.goBacks, undefined, 'the guest must not be moved')
  })

  it('still leaves the view when the guest is not showing a page', async () => {
    const { host, options, ready, clickControl } = await openView({ guestUrl: 'dsh-app://app/', canGoBack: true })
    ready()
    clickControl()
    assert.equal(host.hidden, true, 'a guest that is not showing a page keeps the plain meaning')
    assert.equal(options.goBacks, undefined)
  })

  it('reopens the last chat interface when the guest cannot step back itself', async () => {
    const conversation = CHAT_ORIGIN + '/a/chat/s/8f2'
    const { options, ready, navigate, clickControl } = await openView({})
    ready()
    navigate(conversation)
    // The user follows a link out of the conversation, then asks the control for the chat
    // interface; the guest reports no usable history, so the recorded address is used.
    navigate('https://example.com/article')
    options.canGoBack = false
    clickControl()
    assert.equal(options.loads.at(-1), conversation, 'the conversation must be reloaded instead of lost')
  })

  it('sizes the view from the frame behind the renderer outlet anchor', async () => {
    // The renderer mounts `#root > div[data-slot="root"]` (display:contents) and renders
    // the frame inside it. Walking up from the brand used to stop at that anchor, so
    // `left` collapsed to 0 (the view covered the sidebar) and the layout observer
    // watched a node that never changes.
    const { host, dom } = await openView({ columns: '280px minmax(0px, 1fr) minmax(0px, 0px)' })
    assert.equal(host.style.left, '280px', 'the sidebar column must be left out of the view')
    assert.equal(host.style.top, '0px')
    // Windows publishes the width and radius as custom properties on the frame itself;
    // a sidebar drag rewrites them, and the view must follow that change live.
    dom.frame.computedStyle.vars['--dsh-windows-sidebar-width'] = '300px'
    dom.frame.computedStyle.vars['--dsh-windows-content-radius'] = '16px'
    dom.flush()
    assert.equal(host.style.left, '300px', 'dragging the sidebar must move the view')
    assert.equal(host.style.borderTopLeftRadius, '16px', 'the content radius must be mirrored')
  })

  it('measures the sidebar column when the published track is not a pixel width', async () => {
    const { host } = await openView({ columns: 'minmax(280px, 1fr) minmax(0px, 1fr) 0px', sidebarWidth: 320 })
    assert.equal(host.style.left, '320px', 'the sidebar column width is the last resort')
  })

  it('keeps the title working after the sidebar collapses and expands', async () => {
    // The host unmounts the brand while collapsed (and auto-collapses below 1024px), then
    // mounts a fresh button on expand. A one-shot bind left that fresh node undecorated,
    // so clicking the title created a session instead of toggling the view.
    const { host, dom } = await openView({})
    const oldButton = dom.brandButton
    oldButton.remove()
    dom.state.brandIdentity = null
    dom.flush()
    assert.equal(oldButton.getAttribute('data-dsh-product-trigger'), null, 'the detached node must be released')
    const { button } = dom.mountBrand()
    dom.flush()
    assert.equal(button.getAttribute('data-dsh-product-trigger'), '', 'the fresh brand must be decorated')
    let prevented = false
    button.listeners.find(([type]) => type === 'click')[1]({ preventDefault() { prevented = true }, stopImmediatePropagation() {} })
    assert.equal(prevented, true, 'the host new-session click must still be swallowed')
    assert.equal(host.hidden, true, 'the re-bound title must toggle the view')
  })

  it('hands the lease back when the plugin is disposed mid-acquire', async () => {
    let resolveAcquire = null
    const { module, dom, released } = loadForActivation({
      brand: true,
      acquire: () => new Promise((resolve) => { resolveAcquire = resolve }),
    })
    let dispose = null
    module.apply({ effect: (fn) => { dispose = fn(); return () => {} } })
    dom.brandButton.listeners.find(([type]) => type === 'click')[1]({ preventDefault() {}, stopImmediatePropagation() {} })
    // Teardown lands while the lease round trip is still in flight.
    dispose()
    resolveAcquire({ lease: 'lease-1', partition: 'partition-1' })
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(released, ['lease-1'], 'an acquired lease must never leak')
    assert.equal(dom.document.body.children.some((node) => node.id === 'dsh-chat-view'), false, 'the view host must be gone')
  })

  it('follows the host interface language', async () => {
    const { dom, back } = await openView({ lang: 'en-US' })
    assert.equal(dom.brandButton.getAttribute('aria-label'), 'Switch to DeepSeek Chat')
    assert.equal(back.getAttribute('aria-label'), 'Back to DeepSeek Harness')
  })

  it('owns its stylesheet and stays below the host portal surfaces', () => {
    const { module, dom } = loadForActivation({ brand: true })
    let dispose = null
    module.apply({ effect: (fn) => { dispose = fn(); return () => {} } })
    const style = dom.document.head.children.find((node) => node.tagName === 'STYLE')
    assert.ok(style, 'the switcher must install its stylesheet')
    assert.equal(style.getAttribute('data-plugin'), '@guojing6/dsh-deepseek-chat', 'the host evicts plugin styles by this attribute')
    assert.match(style.textContent, /#dsh-chat-view \{[^}]*z-index:900/, 'host menus and modals (1000+) must paint above the guest')
    dispose()
  })

  it('navigates the current page on web instead of building a guest', () => {
    // The web surface has no shell to host a webview, so the same click keeps the
    // documented behavior of opening the chat in the current page.
    const { module, dom, assigned } = loadForActivation({ brand: true, protocol: 'http:' })
    module.apply({ effect: (fn) => { fn(); return () => {} } })
    dom.brandButton.listeners.find(([type]) => type === 'click')[1]({ preventDefault() {}, stopImmediatePropagation() {} })
    assert.deepEqual(assigned, [CHAT_ORIGIN + '/'], 'web must navigate the current page')
    assert.equal(dom.document.body.children.some((node) => node.id === 'dsh-chat-view'), false, 'web must not build a guest view')
  })

  it('puts the view away when the guest main document fails to load', async () => {
    const { host, ready, failLoad } = await openView({})
    ready()
    failLoad({ isMainFrame: true, errorCode: -105, errorDescription: 'NAME_NOT_RESOLVED', validatedURL: CHAT_ORIGIN + '/' })
    assert.equal(host.hidden, true, 'a blank guest must not stay in front of the content')
  })

  it('keeps the view when a page opened from a conversation fails to load', async () => {
    const { host, ready, failLoad } = await openView({})
    ready()
    failLoad({ isMainFrame: true, errorCode: -105, errorDescription: 'NAME_NOT_RESOLVED', validatedURL: 'https://example.com/article' })
    assert.equal(host.hidden, false, 'a failed link must not hide the guest behind it')
  })

  it('shrinks to the main column so an In-App Browser tab stays visible', async () => {
    const { host, dom } = await openView({ rightbarWidth: 320, bottomRowHeight: 24 })
    assert.equal(host.style.right, '320px', 'the right sidebar must not be covered')
    assert.equal(host.style.bottom, '24px', 'the shell bottom row must not be covered')
    // Opening or dragging the right sidebar rewrites the frame boxes; the layout
    // observer re-applies the insets on the next mutation.
    dom.centerColumn.rect = { ...dom.centerColumn.rect, right: 700 }
    dom.flush()
    assert.equal(host.style.right, '300px', 'the view must follow the column solve')
  })

  it('opens an answer link through DSH\'s own link-opening preference', async () => {
    // The ui-chat preference "In-App Sidebar" must win over the embedded view, exactly as
    // it does for a transcript link: the sidebar Browser tab opens and the chat stays put.
    const opened = []
    const services = {
      configForms: { get: () => ({ getSnapshot: () => ({ value: { linkOpening: 'sidebar' } }) }) },
      sidebarRightTabs: { get: (id) => (id === 'browser' ? {} : undefined) },
      sidebarRight: { openTab: (id, options) => opened.push([id, options]) },
    }
    const { ready, subscriptions } = await openView({ services })
    ready()
    subscriptions.at(-1).listener('https://example.com/article')
    // The plugin's objects live in the vm realm, so compare fields rather than realms.
    assert.equal(opened.length, 1, 'exactly one destination must be used')
    assert.equal(opened[0][0], 'browser', 'the sidebar Browser tab takes the link')
    assert.equal(opened[0][1].params.url, 'https://example.com/article')
  })

  it('opens an answer link in the default browser when that is the preference', async () => {
    const opened = []
    const services = {
      configForms: { get: () => ({ getSnapshot: () => ({ value: { linkOpening: 'new-tab' } }) }) },
      sidebarRightTabs: { get: () => ({}) },
      sidebarRight: { openTab: () => { throw new Error('the sidebar browser must not be used') } },
    }
    const { ready, subscriptions } = await openView({ services, open: (url) => { opened.push(url); return {} } })
    ready()
    subscriptions.at(-1).listener('https://example.com/article')
    assert.deepEqual(opened, ['https://example.com/article'], 'the default browser is the host preference')
  })

  it('keeps loading links in the view when the host exposes no link preference', async () => {
    const { ready, subscriptions, options } = await openView({})
    ready()
    subscriptions.at(-1).listener('https://example.com/article')
    assert.equal(options.loads.at(-1), 'https://example.com/article', 'an older host keeps the in-view behavior')
  })
})
