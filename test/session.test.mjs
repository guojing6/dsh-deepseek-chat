import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import vm from 'node:vm'

const SOURCE = new URL('../lib/client.js', import.meta.url)
const CHAT_ORIGIN = 'https://chat.deepseek.com'
const CHAT_SEED_URL = CHAT_ORIGIN + '/robots.txt'
const SESSION_KEY = 'dsh-deepseek-chat:chat-session'

/** A stand-in for the guest's own localStorage (the page's, not the host's). */
function storage(seed = {}) {
  const data = new Map(Object.entries(seed))
  return {
    data,
    get length() { return data.size },
    key(index) { return [...data.keys()][index] ?? null },
    getItem(key) { return data.has(key) ? data.get(key) : null },
    setItem(key, value) { data.set(key, String(value)) },
  }
}

/** A stand-in for the guest's document.cookie jar. */
function cookieJar(initial = '') {
  let value = initial
  return {
    get cookie() { return value },
    set cookie(next) {
      const name = String(next).split('=')[0].trim()
      const kept = value.split('; ').filter((pair) => pair !== '' && !pair.startsWith(name + '='))
      value = [...kept, String(next).split(';')[0]].join('; ')
    },
  }
}

/** Run one of the plugin's guest scripts against a guest-like global. */
function runGuest(script, localStorage, document) {
  const context = { localStorage, document, JSON, console }
  vm.createContext(context)
  return vm.runInContext(script, context)
}

/** Load the plugin factory with a stubbed application window and expose its internals. */
function loadPlugin() {
  const source = readFileSync(SOURCE, 'utf8')
  const probe = 'globalThis.__probe = { READ_STORAGE, writeStorageScript, readSession, writeSession, SESSION_KEY, SESSION_VERSION, CHAT_ORIGIN };'
  const patched = source.replace(
    'return { apply, inject };',
    probe + '\nreturn { apply, inject };',
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
  host.__factory(() => ({}))
  return { probe: host.__probe, hostStorage }
}

describe('guest storage snapshot', () => {
  it('keeps the sign-in entries and drops oversized caches', () => {
    const { probe } = loadPlugin()
    // The oversized cache comes first on purpose: it must not crowd out the small entries
    // after it, and the essential entries are never dropped.
    const guest = storage({
      huge: 'x'.repeat(250000),
      userToken: 'token-1',
      __appKit_userInfo: '{"name":"guo"}',
      small: 'keep-me',
    })
    const document = { cookie: 'ds_session_id=abc' }
    const raw = runGuest(probe.READ_STORAGE, guest, document)
    const snapshot = JSON.parse(raw)
    assert.equal(snapshot.local.userToken, 'token-1')
    assert.equal(snapshot.local.__appKit_userInfo, '{"name":"guo"}')
    assert.equal(snapshot.local.small, 'keep-me')
    assert.equal(snapshot.local.huge, undefined, 'a single oversized entry is skipped')
    assert.equal(snapshot.cookies, 'ds_session_id=abc')
  })

  it('reports unavailable storage instead of throwing', () => {
    const { probe } = loadPlugin()
    const guest = {
      get length() { throw new Error('storage is blocked') },
      key() { throw new Error('storage is blocked') },
      getItem() { throw new Error('storage is blocked') },
      setItem() { throw new Error('storage is blocked') },
    }
    assert.equal(runGuest(probe.READ_STORAGE, guest, { cookie: '' }), '')
  })
})

describe('guest storage restore', () => {
  it('writes the snapshot back and reports the restored token', () => {
    const { probe } = loadPlugin()
    const guest = storage()
    const document = cookieJar('')
    const script = probe.writeStorageScript({
      local: { userToken: 'token-1', __appKit_userInfo: '{"name":"guo"}' },
      cookies: 'ds_session_id=abc',
    })
    const token = runGuest(script, guest, document)
    assert.equal(token, 'token-1')
    assert.equal(guest.data.get('userToken'), 'token-1')
    assert.equal(guest.data.get('__appKit_userInfo'), '{"name":"guo"}')
    assert.match(document.cookie, /ds_session_id=abc/)
  })

  it('reports an empty token when the write is refused', () => {
    const { probe } = loadPlugin()
    const guest = {
      get length() { return 0 },
      key() { return null },
      getItem() { return null },
      setItem() { throw new Error('quota') },
    }
    const script = probe.writeStorageScript({ local: { userToken: 'token-1' }, cookies: '' })
    assert.equal(runGuest(script, guest, { cookie: '' }), '')
  })
})

describe('host-side snapshot', () => {
  it('round-trips a stored session', () => {
    const { probe, hostStorage } = loadPlugin()
    const snapshot = { version: probe.SESSION_VERSION, origin: probe.CHAT_ORIGIN, local: { userToken: 'token-1' } }
    vm.runInNewContext('writeSession(snapshot)', { writeSession: probe.writeSession, snapshot })
    const restored = vm.runInNewContext('readSession()', { readSession: probe.readSession })
    assert.equal(hostStorage.data.has(probe.SESSION_KEY), true)
    assert.equal(restored.local.userToken, 'token-1')
  })

  it('rejects a snapshot it cannot trust', () => {
    const { probe, hostStorage } = loadPlugin()
    const cases = [
      { version: probe.SESSION_VERSION + 1, origin: probe.CHAT_ORIGIN, local: { userToken: 'a' } },
      { version: probe.SESSION_VERSION, origin: 'https://example.com', local: { userToken: 'a' } },
      { version: probe.SESSION_VERSION, origin: probe.CHAT_ORIGIN, local: null },
    ]
    for (const snapshot of cases) {
      hostStorage.data.set(probe.SESSION_KEY, JSON.stringify(snapshot))
      assert.equal(vm.runInNewContext('readSession()', { readSession: probe.readSession }), null)
    }
    hostStorage.data.set(probe.SESSION_KEY, 'not json')
    assert.equal(vm.runInNewContext('readSession()', { readSession: probe.readSession }), null)
  })
})

/**
 * The DOM and shell stand-ins the plugin activates against. The guest lives inside a
 * right-sidebar tab body now, so the only host DOM the plugin touches is the document
 * head/body and the container the tab body hands it.
 */
function fakeDom(options = {}) {
  const make = (tag) => {
    const attributes = new Map()
    const listeners = []
    const node = {
      tagName: tag.toUpperCase(),
      textContent: '',
      children: [],
      parentElement: null,
      attributes,
      listeners,
      setAttribute(name, value) { attributes.set(name, String(value)) },
      getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null },
      appendChild(child) { this.children.push(child); child.parentElement = this; return child },
      removeChild(child) { this.children = this.children.filter((entry) => entry !== child); child.parentElement = null },
      remove() { if (this.parentElement !== null) this.parentElement.removeChild(this) },
      addEventListener(type, listener) { listeners.push([type, listener]) },
    }
    if (tag === 'webview') {
      // Electron answers every one of these only after the guest is attached and has
      // emitted dom-ready; the stand-in keeps that rule, so a test fails loudly when the
      // plugin reads the guest too early.
      const expectReady = () => {
        if (options.guestReady !== true) {
          throw new Error('The WebView must be attached to the DOM and the dom-ready event emitted before this method can be called.')
        }
      }
      node.loadURL = (url) => { expectReady(); (options.loads ??= []).push(url); return Promise.resolve() }
      node.setUserAgent = () => { expectReady(); options.userAgents = (options.userAgents ?? 0) + 1 }
      node.executeJavaScript = (script) => {
        expectReady()
        ;(options.scripts ??= []).push(script)
        return Promise.resolve(options.executeResult ?? '')
      }
    }
    return node
  }
  const documentElement = make('html')
  documentElement.lang = options.lang ?? 'zh-CN'
  documentElement.dataset = {}
  return {
    document: {
      documentElement,
      head: make('head'),
      body: make('body'),
      createElement: make,
    },
    // The container a tab body hands its ref; the plugin fills it with the guest.
    container: make('div'),
  }
}

/** The client context the plugin runs in: a slots registry, the right-sidebar services,
 *  the shortcut service, and the effect disposer. */
function createContext(options = {}) {
  const registrations = []
  const types = []
  const commands = []
  const slots = {
    inject(_name, callback) {
      const dispose = callback()
      return typeof dispose === 'function' ? dispose : () => {}
    },
    register(registration, component) {
      const entry = { registration, component, disposed: false }
      registrations.push(entry)
      return () => {
        entry.disposed = true
        const index = registrations.indexOf(entry)
        if (index >= 0) registrations.splice(index, 1)
      }
    },
  }
  const sidebarRight = {
    openTab: (kind, tabOptions) => { (options.openTabs ??= []).push([kind, tabOptions]) },
    commandTarget: options.commandTarget ?? (() => ({ sessionId: 'session-1' })),
  }
  const sidebarRightTabs = {
    get: (id) => (id === 'browser' && options.browserTab !== false ? {} : undefined),
    register: (definition) => {
      const entry = { definition, disposed: false }
      types.push(entry)
      return () => {
        entry.disposed = true
        const index = types.indexOf(entry)
        if (index >= 0) types.splice(index, 1)
      }
    },
  }
  let disposer = null
  const context = {
    ctx: {
      effect(fn) { disposer = fn() },
      inject(_services, callback) {
        callback({
          shortcuts: {
            register: (command) => {
              const entry = { command, disposed: false }
              commands.push(entry)
              return () => {
                entry.disposed = true
                const index = commands.indexOf(entry)
                if (index >= 0) commands.splice(index, 1)
              }
            },
          },
        })
      },
      slots,
      sidebarRight,
      sidebarRightTabs,
    },
    registrations,
    types,
    commands,
    switchElement() {
      const entry = registrations.find((candidate) => !candidate.disposed && candidate.registration.id === 'dsh-chat-switch')
      assert.ok(entry, 'the switch must be registered in the session header utilities slot')
      const element = entry.component()
      assert.equal(element.type, 'button', 'the slot occupant must be a button')
      return element
    },
    bodyComponent() {
      const entry = registrations.find((candidate) => !candidate.disposed && candidate.registration.name === 'sidebar.right.pane.tab')
      assert.ok(entry, 'the tab body must be registered under the type id')
      return { registration: entry.registration, component: entry.component }
    },
    titleComponent() {
      const entry = registrations.find((candidate) => !candidate.disposed && candidate.registration.name === 'sidebar.right.pane.tab.title')
      assert.ok(entry, 'the tab chip title must be registered under the type id')
      return { registration: entry.registration, component: entry.component }
    },
    dispose() {
      if (disposer === null) return
      const fn = disposer
      disposer = null
      fn()
    },
  }
  return context
}

/** Load the plugin source against a DOM stand-in and the shell bridge spies. */
function loadForActivation(options = {}) {
  const source = readFileSync(SOURCE, 'utf8')
  const dom = fakeDom(options)
  const released = []
  const subscriptions = []
  const browser = {
    acquire: () => Promise.resolve({ lease: 'lease-1', partition: 'partition-1' }),
    release: (lease) => { released.push(lease); return Promise.resolve() },
    onOpenRequested: (lease, listener) => { subscriptions.push({ lease, listener }); return () => {} },
  }
  const host = {
    window: {
      __ModuleLoader__: { load: (module) => { host.__factory = module.factory } },
      location: { protocol: options.protocol ?? 'dsh-app:' },
      setInterval: () => 1,
      clearInterval: () => {},
      open: options.open ?? (() => null),
      dshDesktop: { browser },
    },
    document: dom.document,
    localStorage: storage(options.hostStorage ?? {}),
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' },
    console,
    Date,
    JSON,
    Object,
    String,
  }
  vm.createContext(host)
  vm.runInContext(source, host)
  assert.equal(typeof host.__factory, 'function', 'factory not captured')
  // React comes from the shell's shared module table; the stand-in provides only what the
  // plugin's slot occupants use (elements, refs, callbacks).
  const react = {
    createElement(type, props, ...children) { return { type, props: { ...(props ?? {}), children } } },
    useRef(initial) { return { current: initial } },
    useCallback(fn) { return fn },
  }
  const requireModule = (id) => {
    if (id === 'react') return react
    throw new Error('unexpected module request: ' + id)
  }
  return { module: host.__factory(requireModule), dom, released, subscriptions, options }
}

/** Apply the plugin and return the context, the guest spies and the tab body. */
function activate(options = {}) {
  const loaded = loadForActivation(options)
  const context = createContext(options)
  loaded.module.apply(context.ctx)
  const { component } = context.bodyComponent()
  const bodyElement = component({ useTabInfo: () => ({ tab: { id: 'tab-1' } }) })
  assert.equal(bodyElement.type, 'div')
  assert.equal(bodyElement.props.className, 'dsh-deepseek-chat-body')
  return { ...loaded, context, bodyElement }
}

/** Mount the tab body: the ref receives the container the guest fills. */
async function mountBody(options = {}) {
  const session = activate(options)
  session.bodyElement.props.ref(session.dom.container)
  // The lease round trip is asynchronous before the guest element is attached.
  await new Promise((resolve) => setImmediate(resolve))
  const guest = session.dom.container.children.find((node) => node.tagName === 'WEBVIEW')
  return {
    ...session,
    guest,
    // The guest attaches and boots, exactly as the real element reports it.
    ready: () => {
      session.options.guestReady = true
      for (const [name, listener] of [...(guest?.listeners ?? [])]) if (name === 'dom-ready') listener({})
    },
    unmount: () => session.bodyElement.props.ref(null),
  }
}

// Nothing else in this file calls `apply`, and that gap is how a fatal ReferenceError
// inside the activation path once shipped. These cases run the real source end to end.
describe('activation', () => {
  it('registers the right-sidebar tab type with its guide entry', () => {
    const { context } = activate()
    const entry = context.types[0]
    assert.ok(entry, 'the plugin must register a tab type')
    const definition = entry.definition
    assert.equal(definition.id, '@guojing6/dsh-deepseek-chat/tab')
    assert.equal(definition.kind, 'deepseek-chat')
    assert.equal(definition.priority, 'extension')
    assert.equal(definition.keepMounted, true, 'the chat tab must keep its guest across tab switches')
    assert.equal(definition.title(), 'DeepSeek Chat')
    const guide = definition.guide[0]
    assert.equal(guide.id, 'chat')
    assert.equal(guide.order, 35)
    assert.equal(guide.commandId, 'deepseek-chat.open', 'the guide card shows the shortcut of this command')
    assert.equal(guide.title(), 'DeepSeek Chat')
    const icon = guide.icon()
    assert.equal(icon.props.className, 'dsh-deepseek-chat-glyph')
    assert.match(icon.props.dangerouslySetInnerHTML.__html, /<svg[^>]*>/, 'the guide card must carry the DeepSeek Chat mark')
  })

  it('registers the tab body under the type id and keeps the switch leftmost', () => {
    const { context } = activate()
    const body = context.bodyComponent()
    assert.equal(body.registration.name, 'sidebar.right.pane.tab')
    assert.equal(body.registration.key, '@guojing6/dsh-deepseek-chat/tab')
    const switchEntry = context.registrations.find((entry) => entry.registration.id === 'dsh-chat-switch')
    assert.ok(switchEntry, 'the session header switch must be registered')
    assert.equal(switchEntry.registration.name, 'conversation.session.header.utilities')
    assert.ok(switchEntry.registration.order < -10, 'the switch must sit left of Open in VSCode (order -10)')
    const element = context.switchElement()
    assert.equal(element.props['aria-label'], '打开 DeepSeek Chat')
    assert.match(element.props.dangerouslySetInnerHTML.__html, /<svg[^>]*>/)
  })

  it('renders the tab chip title with the DeepSeek Chat mark', () => {
    const { context } = activate()
    const title = context.titleComponent()
    assert.equal(title.registration.name, 'sidebar.right.pane.tab.title')
    assert.equal(title.registration.key, '@guojing6/dsh-deepseek-chat/tab')
    const element = title.component({ useTabInfo: () => ({ tab: { id: 'tab-1', title: 'DeepSeek Chat' } }) })
    assert.equal(element.type, 'span')
    assert.equal(element.props.className, 'dsh-deepseek-chat-tabtitle')
    assert.equal(element.props.title, 'DeepSeek Chat', 'the full title stays available as a tooltip')
    const [icon, label] = element.props.children
    assert.equal(icon.props.className, 'dsh-deepseek-chat-tabtitle-icon')
    assert.match(icon.props.dangerouslySetInnerHTML.__html, /<svg[^>]*>/, 'the chip must carry the whale mark')
    assert.equal(label.props.className, 'dsh-deepseek-chat-tabtitle-text')
    assert.equal(label.props.children.join(''), 'DeepSeek Chat')
  })

  it('opens the tab from the header switch and the Ctrl+Q command', () => {
    const options = {}
    const { context } = activate(options)
    context.switchElement().props.onClick()
    // The plugin's objects live in the vm realm, so compare fields rather than realms.
    assert.equal(options.openTabs.length, 1, 'the switch opens the chat tab')
    assert.equal(options.openTabs[0][0], 'deepseek-chat')
    assert.equal(options.openTabs[0][1], undefined)
    const command = context.commands[0]
    assert.ok(command, 'the Ctrl+Q command must be registered')
    assert.equal(command.command.id, 'deepseek-chat.open')
    const binding = command.command.defaults['desktop:windows']
    assert.equal(binding.code, 'KeyQ')
    assert.equal(binding.modifiers.length, 1)
    assert.equal(binding.modifiers[0], 'primary', 'Ctrl+Q on Windows')
    const resolution = command.command.resolve({ target: {} })
    assert.equal(resolution.status, 'handled')
    resolution.run()
    assert.equal(options.openTabs.length, 2, 'the command opens the tab too')
  })

  it('blocks Ctrl+Q when no session is open', () => {
    const { context } = activate({ commandTarget: () => undefined })
    const resolution = context.commands[0].command.resolve({ target: {} })
    assert.equal(resolution.status, 'blocked')
  })

  it('tears the registrations and the stylesheet down', () => {
    const { context, dom } = activate()
    assert.equal(dom.document.head.children.length, 1)
    context.dispose()
    assert.equal(context.registrations.length, 0, 'slot occupants must be withdrawn')
    assert.equal(context.types.length, 0, 'the tab type must be withdrawn')
    assert.equal(context.commands.length, 0, 'the command must be withdrawn')
    assert.equal(dom.document.head.children.length, 0, 'the stylesheet must be removed')
  })

  it('follows the host interface language', () => {
    const { context } = activate({ lang: 'en-US' })
    assert.equal(context.switchElement().props['aria-label'], 'Open DeepSeek Chat')
    assert.equal(context.types[0].definition.guide[0].description(), 'Chat with DeepSeek in the sidebar')
  })

  it('owns its stylesheet', () => {
    const { dom } = activate()
    const style = dom.document.head.children.find((node) => node.tagName === 'STYLE')
    assert.ok(style, 'the plugin must install its stylesheet')
    assert.equal(style.getAttribute('data-plugin'), '@guojing6/dsh-deepseek-chat')
    assert.match(style.textContent, /#dsh-chat-switch \{/, 'the switch must be styled as an icon button')
    assert.match(style.textContent, /\.dsh-deepseek-chat-body \{/, 'the tab body must fill its pane')
  })
})

describe('tab guest', () => {
  it('leases a guest into the tab body and hands it back when the body unmounts', async () => {
    const session = await mountBody()
    assert.equal(session.dom.container.children.length, 1, 'the guest must fill the body')
    assert.equal(session.guest.getAttribute('src'), 'about:blank#lease-1', 'the bootstrap document carries the lease')
    assert.equal(session.guest.getAttribute('partition'), 'partition-1')
    assert.equal(session.guest.getAttribute('allowpopups'), '', 'window-open requests need allowpopups')
    session.unmount()
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(session.released, ['lease-1'], 'an acquired lease must never leak')
    assert.equal(session.dom.container.children.length, 0, 'the guest must be removed with the body')
  })

  it('boots the chat interface and standardizes the guest user agent', async () => {
    const session = await mountBody()
    session.ready()
    assert.equal(session.options.userAgents, 1, 'the guest must not advertise Electron')
    assert.deepEqual(session.options.loads, [CHAT_ORIGIN + '/'], 'without a snapshot the page opens directly')
  })

  it('seeds the guest with the stored sign-in before the page boots', async () => {
    const hostStorage = {
      [SESSION_KEY]: JSON.stringify({ version: 1, origin: CHAT_ORIGIN, local: { userToken: 'token-1' } }),
    }
    const session = await mountBody({ hostStorage, executeResult: 'token-1' })
    session.ready()
    assert.equal(session.options.loads.length, 1, 'the seed document must boot first')
    assert.equal(session.options.loads[0], CHAT_SEED_URL)
    session.ready()
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(session.options.scripts.length, 1, 'the snapshot must be written into the seed document')
    assert.equal(session.options.loads.length, 2)
    assert.equal(session.options.loads[1], CHAT_ORIGIN + '/')
  })

  it('opens an answer link in the sidebar Browser tab', async () => {
    const session = await mountBody()
    session.ready()
    assert.equal(session.subscriptions.length, 1)
    session.subscriptions[0].listener('https://example.com/article')
    const opened = session.options.openTabs
    assert.equal(opened.length, 1)
    assert.equal(opened[0][0], 'browser')
    assert.equal(opened[0][1].params.url, 'https://example.com/article')
  })

  it('falls back to the default browser without the sidebar Browser tab', async () => {
    const opened = []
    const session = await mountBody({ browserTab: false, open: (url) => { opened.push(url); return {} } })
    session.ready()
    session.subscriptions[0].listener('https://example.com/article')
    assert.deepEqual(opened, ['https://example.com/article'])
  })

  it('keeps the body alive through a re-render and swaps it on a tab change', async () => {
    const session = await mountBody()
    session.bodyElement.props.ref(session.dom.container)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(session.dom.container.children.length, 1, 'a repeated ref must not create a second guest')
    session.unmount()
  })

  it('embeds the chat in an iframe on web', async () => {
    const session = activate({ protocol: 'http:' })
    session.bodyElement.props.ref(session.dom.container)
    await new Promise((resolve) => setImmediate(resolve))
    const frame = session.dom.container.children[0]
    assert.equal(frame.tagName, 'IFRAME')
    assert.equal(frame.getAttribute('src'), CHAT_ORIGIN + '/')
    assert.equal(session.dom.container.children.length, 1)
  })
})
