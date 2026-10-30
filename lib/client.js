window.__ModuleLoader__.load({
  id: "@guojing6/dsh-deepseek-chat",
  factory: () => {
const CHAT_ORIGIN = "https://chat.deepseek.com";
const CHAT_URL = CHAT_ORIGIN + "/";
// Every unknown path on this host answers with the application document itself, so
// the seed page has to be a path that really exists as a static file: this one is
// a tiny text/plain document that does not boot the application.
const CHAT_SEED_URL = CHAT_ORIGIN + "/robots.txt";
// Where the guest is decides what the view's round control means: a link in an answer
// opens in this same view (see onOpenRequested), so the guest can be showing a page
// that is not the application. The seed document is served by the same host but does
// not boot the application, so it never counts as the chat interface.
const isChatUrl = (url) => typeof url === "string" && url.startsWith(CHAT_ORIGIN + "/") && url !== CHAT_SEED_URL;
// A page the user opened from a conversation: a real web document that is neither the
// application nor the plugin's own seed document.
const isGuestPage = (url) => typeof url === "string" && /^https?:\/\//i.test(url) && !isChatUrl(url) && url !== CHAT_SEED_URL;
// Host-page storage key holding the last snapshot of the guest's storage.
const SESSION_KEY = "dsh-deepseek-chat:chat-session";
const SESSION_VERSION = 1;
const SNAPSHOT_INTERVAL_MS = 15000;
// The host animates the right sidebar's grid track; re-reading the column boxes once the
// transition has settled keeps the view flush with the main column.
const INSET_SETTLE_MS = 400;
const SNAPSHOT_LIMIT = 200000;
// The entries the application needs to consider itself signed in. Everything else
// it keeps is a preference or a cache, so a large guest store may drop those but
// never these.
const SESSION_ESSENTIAL_KEYS = ["userToken", "__appKit_userInfo"];
const TRIGGER_ATTR = "data-dsh-product-trigger";
const CHAT_VIEW_ID = "dsh-chat-view";
const CHAT_VIEW_BACK_ID = "dsh-chat-view-back";
const PLUGIN_ID = "@guojing6/dsh-deepseek-chat";
const CAPTURE_EVENTS = ["pointerdown", "mousedown", "touchstart"];
// The Desktop shell serves the application window from dsh-app://app/ and its
// preload marks <html> with data-platform (darwin or win32); the Web surface is
// http(s) and has neither. The protocol is checked first because the preload's
// mark is deferred to DOMContentLoaded when it runs before the document root.
const IS_DESKTOP = window.location.protocol === "dsh-app:"
  || document.documentElement.dataset.platform !== undefined;
// The host keeps <html lang> in sync with its locale service (zh-CN for Chinese),
// so the plugin's own chrome can follow the interface language instead of being
// pinned to one translation.
const isChinese = () => String(document.documentElement.lang ?? "").toLowerCase().startsWith("zh");
const labelSwitch = () => (isChinese() ? "切换 DeepSeek Chat" : "Switch to DeepSeek Chat");
const labelBackHarness = () => (isChinese() ? "返回 DeepSeek Harness" : "Back to DeepSeek Harness");
const labelBackChat = () => (isChinese() ? "返回 DeepSeek Chat" : "Back to DeepSeek Chat");
// Match the host brand element.
// Its class name carries a build-time CSS-module hash that differs between the
// Web and Desktop builds and between releases, so match the stable local name,
// not one hash. The brand is distinct from the New Session and sidebar collapse
// buttons.
const BRAND_IDENTITY_SELECTOR = '[class*="brandIdentity"]';
// `#root` is the renderer's mount container; the shell's frame is its occupant.
const ROOT_ID = "root";
function findBrandButton() {
  const identity = document.querySelector(BRAND_IDENTITY_SELECTOR);
  if (!identity) return null;
  // Web and Windows/Linux Desktop wrap the brand in the New Session button;
  // macOS Desktop keeps it a plain span inside the window-drag logo row.
  return identity.closest("button") ?? identity.parentElement ?? null;
}

// The renderer mounts the root occupant through an outlet anchor that is
// `display:contents` (a pure addressable surface), so `#root`'s element child is no
// longer necessarily the frame itself. Walk the first-element-child chain until a
// real grid container answers: that is the element publishing the column solve,
// and the walk stays correct whether the renderer wraps the slot or not.
function frameLayer(start) {
  for (let node = start; node !== null; node = node.firstElementChild) {
    const style = getComputedStyle(node);
    const columns = String(style.gridTemplateColumns ?? "").trim();
    if (style.display !== "contents" && columns !== "" && columns !== "none") return node;
  }
  return null;
}

// Resolve the frame from `#root` alone. The brand is unmounted whenever the sidebar
// collapses (the host also auto-collapses below 1024px), so geometry must not
// depend on it; a host that mounts the tree elsewhere falls back to the brand's
// ancestors.
function findFrame() {
  const root = document.getElementById?.(ROOT_ID) ?? null;
  if (root !== null) {
    const resolved = frameLayer(root.firstElementChild);
    if (resolved !== null) return resolved;
  }
  let candidate = document.querySelector(BRAND_IDENTITY_SELECTOR);
  while (candidate !== null && candidate.parentElement !== null && candidate.parentElement.id !== ROOT_ID) {
    candidate = candidate.parentElement;
  }
  return candidate !== null && candidate.parentElement?.id === ROOT_ID ? frameLayer(candidate) : null;
}

// The frame publishes its own insets as custom properties on the frame element
// (the caption height is the exception: the Windows preload sets that one on
// <html>), so read them where they live and mirror them onto the view. The guest
// then lands exactly on the content column, leaving the caption strip and the
// sidebar in place instead of covering them.
//
// The sidebar width is only published on Windows — `AppFrame.tsx` guards that style
// entry with `data-windows-titlebar` — so the frame's column solve is the next
// source, and the sidebar column itself (the frame's first element child) is the
// measurement of last resort. That keeps the view off the sidebar on every platform
// instead of letting `left` collapse to 0 and cover it.
//
// The trailing edges come from the main column's own box: when the right sidebar opens
// (for instance because an answer link opened its In-App Browser tab) the view has to
// shrink to the center column instead of painting over the page it just opened.
function readFrameInsets(frame) {
  const frameStyle = frame === null ? null : getComputedStyle(frame);
  const read = (style, name) => (style === null ? "" : style.getPropertyValue(name).trim());
  const sidebarWidth = () => {
    const published = read(frameStyle, "--dsh-windows-sidebar-width");
    if (published !== "") return published;
    const track = read(frameStyle, "grid-template-columns").split(/\s+/)[0] ?? "";
    if (/^\d+(?:\.\d+)?px$/.test(track)) return track;
    const column = frame?.firstElementChild ?? null;
    if (column !== null && typeof column.getBoundingClientRect === "function") {
      const measured = column.getBoundingClientRect().width;
      if (Number.isFinite(measured) && measured >= 0) return Math.round(measured) + "px";
    }
    return "";
  };
  const edge = (value) => (Number.isFinite(value) && value >= 0 ? Math.round(value) + "px" : "0px");
  const trailing = () => {
    if (frame === null || typeof frame.getBoundingClientRect !== "function" || typeof frame.querySelector !== "function") {
      return { right: "0px", bottom: "0px" };
    }
    const center = frame.querySelector('[class*="centerCol"]');
    if (center === null || typeof center.getBoundingClientRect !== "function") return { right: "0px", bottom: "0px" };
    const frameRect = frame.getBoundingClientRect();
    const centerRect = center.getBoundingClientRect();
    return { right: edge(frameRect.right - centerRect.right), bottom: edge(frameRect.bottom - centerRect.bottom) };
  };
  return {
    top: read(getComputedStyle(document.documentElement), "--dsh-windows-titlebar-height") || "0px",
    left: sidebarWidth() || "0px",
    ...trailing(),
    radius: read(frameStyle, "--dsh-windows-content-radius") || "0px",
  };
}

// Rebuild the standard Chromium user agent from the host agent: keep its platform
// clause and Chromium version, drop the Electron and product tokens that mark an
// embedded view (DeepSeek Chat answers those with an environment warning).
function standardUserAgent() {
  const source = navigator.userAgent;
  const platform = /\(([^)]*)\)/.exec(source)?.[1] ?? "Windows NT 10.0; Win64; x64";
  const chromium = /Chrome\/([\d.]+)/.exec(source)?.[1] ?? "130.0.0.0";
  return "Mozilla/5.0 (" + platform + ") AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + chromium + " Safari/537.36";
}

// DeepSeek Chat keeps its sign-in in localStorage (a `userToken` handle plus
// `__appKit_userInfo`) and marks the cookies that matter HttpOnly. The shell gives
// each workspace one in-memory partition (`dsh-sidebar-browser-<uuid>`, with no
// `persist:` prefix) shared by its guests, so nothing inside the guest outlives the
// process and the page asks for a new sign-in on every restart. This mirrors the
// guest's storage into the application page's own localStorage — `dsh-app` is
// registered as a standard, secure scheme on the persistent default session, so that
// copy does survive — and writes it back into a same-origin seed document before the
// application document boots, because the page reads its token once, at startup.
//
// Reads the guest's storage as JSON, or the empty string when it is unavailable.
const READ_STORAGE = `(() => {
  const required = ${JSON.stringify(SESSION_ESSENTIAL_KEYS)};
  const local = {};
  let size = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key === null) continue;
      const value = localStorage.getItem(key);
      if (value === null) continue;
      // A single oversized cache must not crowd out the small entries after it, so
      // the cap only rejects the entry that would cross it.
      if (!required.includes(key) && size + key.length + value.length > ${SNAPSHOT_LIMIT}) continue;
      size += key.length + value.length;
      local[key] = value;
    }
  } catch (error) { return ""; }
  return JSON.stringify({ local, cookies: document.cookie || "" });
})()`;

// Writes a snapshot back into the guest's storage, returning the restored sign-in
// token so a failure to seed is visible rather than silent.
function writeStorageScript(snapshot) {
  return `(() => {
  const data = ${JSON.stringify(snapshot)};
  try {
    for (const key of Object.keys(data.local)) localStorage.setItem(key, data.local[key]);
  } catch (error) { return ""; }
  for (const pair of String(data.cookies || "").split(";")) {
    const entry = pair.trim();
    if (entry !== "") document.cookie = entry + "; path=/; max-age=31536000; SameSite=Lax; Secure";
  }
  return localStorage.getItem("userToken") || "";
})()`;
}

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    const usable = parsed !== null && typeof parsed === "object"
      && parsed.version === SESSION_VERSION && parsed.origin === CHAT_ORIGIN
      && parsed.local !== null && typeof parsed.local === "object";
    return usable ? parsed : null;
  } catch (error) { return null; }
}

function writeSession(snapshot) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
  } catch (error) {
    // The host origin's quota is its own; a failed mirror only costs the next sign-in.
    console.error("dsh-deepseek-chat: could not store the DeepSeek session", error);
  }
}

// A link in a DeepSeek Chat answer should behave like a link in a DSH transcript, so the
// view forwards it to the host's own link-opening preference instead of taking the chat
// over: Settings → General → Open chat links in selects the In-App Sidebar (a right
// sidebar Browser tab) or the Default Browser. The preference lives in the `ui-chat`
// config form and the sidebar browser is an optional service, so both are read lazily
// and defensively; when the host exposes neither, the caller keeps the old behavior of
// loading the page inside the view.
const CHAT_SETTINGS_NAMESPACE = "ui-chat";
function createLinkOpener(ctx) {
  const service = (name) => (typeof ctx?.get === "function" ? ctx.get(name) : undefined);
  const readPreference = () => {
    try {
      const form = service("configForms")?.get?.(CHAT_SETTINGS_NAMESPACE);
      const value = form?.getSnapshot?.()?.value;
      // No form yet (older host, or the settings service is absent): let the caller keep
      // the previous in-view behavior instead of guessing a destination.
      if (value === undefined || value === null) return undefined;
      return value.linkOpening === "new-tab" ? "new-tab" : "sidebar";
    } catch (error) {
      return undefined;
    }
  };
  const browserTabAvailable = () => {
    try {
      return service("sidebarRightTabs")?.get?.("browser") !== undefined;
    } catch (error) {
      return false;
    }
  };
  return (url) => {
    const preference = readPreference();
    // No config service at all: an older or reduced host, keep the in-view fallback.
    if (preference === undefined) return false;
    if (preference === "sidebar" && browserTabAvailable()) {
      try {
        const sidebarRight = service("sidebarRight");
        if (typeof sidebarRight?.openTab === "function") {
          sidebarRight.openTab("browser", { params: { url } });
          return true;
        }
      } catch (error) {
        // The tab could not be opened; the external browser is the host's own fallback.
      }
    }
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  };
}

// Desktop-only in-application DeepSeek Chat view: the product switch stays
// inside the window the way the Codex desktop client switches between its
// products, instead of handing the URL to the system browser.
//
// The shell admits a <webview> only when it carries a lease its main process
// issued, so this acquires one through the same bridge the built-in sidebar
// browser uses. The guest is kept alive while hidden, so switching back and
// forth is instant; it is released only on dispose.
//
// The page itself is never rewritten: the only guest script this plugin runs reads
// and writes the guest's own storage. The guest keeps its own Chromium history, so the
// way out of a page opened from a conversation is the same control that later leaves
// the view (see onBack).
//
// The rest of the shell's policy still applies as designed: permissions are
// refused and downloads are blocked.
const CHAT_WORKSPACE = "dsh-deepseek-chat";
// A build cancelled by disposal is not a failure: the caller must not fall back to
// the system browser for it.
const CANCELLED = { cancelled: true };
function createChatView(ctx) {
  const host = document.createElement("div");
  host.id = CHAT_VIEW_ID;
  host.hidden = true;
  const openLink = createLinkOpener(ctx);
  const back = document.createElement("button");
  back.type = "button";
  back.id = CHAT_VIEW_BACK_ID;
  // Filled disc with the arrow knocked out, from the icon supplied for this
  // control. The disc *is* the button shape, so the CSS around it stays
  // transparent and only the colour is themed.
  back.innerHTML = '<svg viewBox="0 0 1025 1024" aria-hidden="true" focusable="false"><path fill="currentColor" d="M513 0C230.2 0 1 229.2 1 512s229.2 512 512 512 512-229.2 512-512S795.8 0 513 0z m335.7 766.4s-26.4-42.6-37.1-57.5C801 694 755.9 638.4 686 606.1c-69.9-32.2-186.8-26.5-186.8-26.5v134.2L177.1 485.7l322.1-228.2V393s77.4 5.8 117.8 14.2c68.1 14.1 105.5 47.7 105.5 47.7 39.9 23.8 88.8 87.9 109.2 165.2 20.4 77.2 17 146.3 17 146.3z"/></svg>';
  back.setAttribute("aria-label", labelBackHarness());
  back.title = labelBackHarness();
  host.appendChild(back);
  document.body.appendChild(host);
  let element = null;
  // A <webview> answers its own methods only once the guest is attached and has emitted
  // dom-ready; before that every call throws "The WebView must be attached to the DOM and
  // the dom-ready event emitted before this method can be called". The view is revealed as
  // soon as the lease is in hand, well before the page loads, so every read of the guest
  // goes through guestUrl() instead of touching the element directly.
  let guestReady = false;
  let lease = null;
  // The bridge that issued the lease is captured with it, so the release path does not
  // depend on `window.dshDesktop` still being present during teardown.
  let leaseApi = null;
  let unsubscribeOpen = null;
  let opening = null;
  let snapshotTimer = null;
  let settleTimer = null;
  let layoutObserver = null;
  let resizeWatched = false;
  // A view hidden (or a plugin disposed) while the lease round trip was in flight must
  // not reveal itself afterwards, so reveal is gated on intent rather than on the build
  // promise, and disposal cancels a build that already started.
  let disposed = false;
  let visibleIntent = false;
  // The shell may rebuild the frame, but it must not be forgotten while it stays
  // mounted: the brand is unmounted by a sidebar collapse, and geometry has to keep
  // tracking the layout at that moment too.
  let frameElement = null;
  // The last chat interface the guest displayed. Chromium history normally holds it
  // (the view boots into the application before any link can open), so this only feeds
  // the fallback for a history that cannot step back on its own.
  let lastChat = null;
  const bridge = () => window.dshDesktop?.browser;
  // The address of the page in front of the user, or the empty string while there is no
  // guest to ask (not built yet, not attached yet, or gone).
  const guestUrl = () => {
    if (element === null || !guestReady) return "";
    try { return element.getURL() ?? ""; } catch (error) { return ""; }
  };
  // The round control carries both meanings, so its label has to follow the guest:
  // away from the application it is the way back to the conversation, and on the
  // application it is the way out of the view.
  const refreshBack = () => {
    const url = guestUrl();
    if (isChatUrl(url)) lastChat = url;
    const label = isGuestPage(url) ? labelBackChat() : labelBackHarness();
    back.setAttribute("aria-label", label);
    back.title = label;
  };
  // Only a sign-in the page still holds is worth keeping. Writing a signed-out
  // snapshot back would resurrect nothing, while overwriting one the page is still
  // validating would cost the session for a single bad load.
  const remember = async () => {
    const view = element;
    const url = guestUrl();
    if (view === null || url === "") return;
    if (!url.startsWith(CHAT_ORIGIN + "/") || url === CHAT_SEED_URL) return;
    let raw;
    try { raw = await view.executeJavaScript(READ_STORAGE); } catch (error) { return; }
    if (typeof raw !== "string" || raw === "") return;
    let parsed;
    try { parsed = JSON.parse(raw); } catch (error) { return; }
    const local = parsed === null || typeof parsed !== "object" ? {} : parsed.local ?? {};
    if (typeof local.userToken !== "string" || local.userToken === "") return;
    writeSession({
      version: SESSION_VERSION,
      origin: CHAT_ORIGIN,
      savedAt: Date.now(),
      local,
      cookies: typeof parsed.cookies === "string" ? parsed.cookies : "",
    });
  };
  const build = async () => {
    const api = bridge();
    if (!api) throw new Error("desktop browser bridge is unavailable");
    const reservation = await api.acquire(CHAT_WORKSPACE);
    // Disposal while the lease was in flight: hand the reservation straight back
    // instead of leaving it attached to a removed host for the process lifetime.
    if (disposed) {
      void Promise.resolve(api.release(reservation.lease)).catch(() => {});
      throw CANCELLED;
    }
    lease = reservation.lease;
    leaseApi = api;
    const view = document.createElement("webview");
    // The bootstrap document carries the lease; the shell rejects a guest whose src or
    // partition does not match the reservation it issued, and it requires the guest's
    // first dom-ready to still be on that bootstrap address.
    view.setAttribute("name", reservation.lease);
    view.setAttribute("partition", reservation.partition);
    view.setAttribute("allowpopups", "");
    view.setAttribute("src", "about:blank#" + reservation.lease);
    element = view;
    // Fresh element, fresh contract: the guest has not attached yet, so nothing may read
    // it until its own dom-ready arrives (see guestUrl).
    guestReady = false;
    // The guest walks bootstrap (about:blank) → seed (a same-origin static document
    // that does not boot the application) → the application document. Seeding before
    // the application document starts is what makes a restored sign-in take effect:
    // the page reads its token once, at startup, and never looks again.
    let stage = "bootstrap";
    const snapshot = readSession();
    // A guest call can throw synchronously as well as reject (that is how Electron
    // answers a detached element), so the load path is guarded either way.
    const loadUrl = (url, onFailure) => {
      try {
        void view.loadURL(url).catch((error) => {
          console.error("dsh-deepseek-chat: failed to open " + url, error);
          if (onFailure !== undefined) onFailure();
        });
      } catch (error) {
        console.error("dsh-deepseek-chat: failed to open " + url, error);
        if (onFailure !== undefined) onFailure();
      }
    };
    const enter = () => { stage = "app"; loadUrl(CHAT_URL); };
    view.addEventListener("dom-ready", () => {
      // From here on the element answers its own methods, so the address can be read and
      // the round control labelled; the reveal path runs before this and must not ask.
      guestReady = true;
      refreshBack();
      if (stage === "bootstrap") {
        // The guest inherits the application user agent, whose Electron and product
        // tokens make the page treat this as an unofficial client and show its
        // environment warning. setUserAgent changes the guest webContents directly,
        // so it survives the shell clearing webPreferences in will-attach-webview,
        // and the bootstrap document is still loaded, so this precedes the real page.
        try { view.setUserAgent(standardUserAgent()); } catch (error) {
          console.error("dsh-deepseek-chat: could not set the guest user agent", error);
        }
        // Without a snapshot there is nothing to seed, so go straight in.
        if (snapshot === null) { enter(); return; }
        stage = "seed";
        loadUrl(CHAT_SEED_URL, enter);
        return;
      }
      if (stage === "seed") {
        stage = "app";
        view.executeJavaScript(writeStorageScript(snapshot))
          .catch((error) => {
            console.error("dsh-deepseek-chat: could not restore the DeepSeek sign-in", error);
            return "";
          })
          .then((restored) => {
            if (restored === "") console.warn("dsh-deepseek-chat: the DeepSeek sign-in was not restored into the guest");
            enter();
          });
        return;
      }
      void remember();
    });
    // A failed main-frame load would leave a blank guest with no way back, so put the
    // view away; the seed page is the exception because its failure falls through to the
    // application, and a failed link keeps the dead page instead of hiding the view.
    // Aborted loads (code -3) are replaced navigations and are ignored.
    view.addEventListener("did-fail-load", (event) => {
      if (event?.errorCode === -3 || event?.isMainFrame === false) return;
      console.error("dsh-deepseek-chat: the chat guest failed to load", event?.errorCode, event?.errorDescription, event?.validatedURL);
      const failedUrl = typeof event?.validatedURL === "string" ? event.validatedURL : "";
      if (stage === "app" && (failedUrl === "" || isChatUrl(failedUrl))) hide();
    });
    // Every navigation decides what the round control means, including the ones the
    // application makes inside its own document (a new conversation, opening a saved
    // one), which is why the in-page event is watched as well.
    view.addEventListener("did-navigate", refreshBack);
    view.addEventListener("did-navigate-in-page", refreshBack);
    // A link that asks for a new window follows the host's own link-opening preference
    // first (a right sidebar Browser tab, or the default browser), so it behaves like a
    // transcript link and leaves the chat where it is. Only a host that exposes no such
    // preference keeps the old behavior of loading the page inside this view. The shell
    // forwards only plain GET window-open requests (no post body) to http(s) destinations
    // that are not the DSH host, so anything else is denied before it can reach here.
    unsubscribeOpen = api.onOpenRequested(reservation.lease, (url) => {
      if (openLink(url)) return;
      try {
        void view.loadURL(url).catch((error) => {
          console.error("dsh-deepseek-chat: failed to follow a link", error);
        });
      } catch (error) {
        console.error("dsh-deepseek-chat: failed to follow a link", error);
      }
    });
    host.appendChild(view);
  };
  const releaseLease = () => {
    const api = leaseApi ?? bridge();
    if (lease !== null && api) void Promise.resolve(api.release(lease)).catch(() => {});
    lease = null;
    leaseApi = null;
  };
  // The frame is cached while it stays mounted; a rebuilt frame is re-resolved here,
  // never through the brand (which a sidebar collapse unmounts).
  const resolveFrame = () => {
    if (frameElement !== null && (frameElement.isConnected ?? frameElement.parentElement !== null)) return frameElement;
    frameElement = findFrame();
    return frameElement;
  };
  const applyInsets = () => {
    // Re-read on every switch and on every layout change: the sidebar width, the right
    // sidebar and the radius follow the frame's current layout, so a value captured once
    // goes stale the moment the sidebar is dragged, collapsed, or auto-collapsed by a
    // narrow window.
    const insets = readFrameInsets(resolveFrame());
    host.style.top = insets.top;
    host.style.left = insets.left;
    host.style.right = insets.right;
    host.style.bottom = insets.bottom;
    host.style.borderTopLeftRadius = insets.radius;
  };
  // The frame answers a sidebar drag or collapse by rewriting the width it publishes in
  // its own inline style, so follow that one attribute instead of polling for it. The
  // right sidebar's track is animated with a CSS transition, so one immediate read lands
  // mid-animation: settle the insets once the transition has finished.
  const watchLayout = () => {
    layoutObserver?.disconnect();
    layoutObserver = null;
    const frame = resolveFrame();
    if (frame === null) return;
    layoutObserver = new MutationObserver(() => {
      if (!isVisible()) return;
      applyInsets();
      settleInsets();
    });
    layoutObserver.observe(frame, { attributes: true, attributeFilter: ["style", "data-sidebar-collapsed", "data-animating"] });
  };
  const settleInsets = () => {
    if (typeof window.setTimeout !== "function") return;
    if (settleTimer !== null) window.clearTimeout?.(settleTimer);
    settleTimer = window.setTimeout(() => {
      settleTimer = null;
      if (isVisible()) applyInsets();
    }, INSET_SETTLE_MS);
  };
  const stopSettle = () => {
    if (settleTimer === null) return;
    window.clearTimeout?.(settleTimer);
    settleTimer = null;
  };
  // The window can change the column solve on its own (the host auto-collapses the
  // sidebar below 1024px), so a resize re-resolves the frame and re-applies the insets.
  const onResize = () => { if (isVisible()) { watchLayout(); applyInsets(); } };
  const startResizeWatch = () => {
    if (resizeWatched || typeof window.addEventListener !== "function") return;
    resizeWatched = true;
    window.addEventListener("resize", onResize);
  };
  const stopResizeWatch = () => {
    if (!resizeWatched) return;
    resizeWatched = false;
    window.removeEventListener("resize", onResize);
  };
  const startTimer = () => {
    // A sign-in is written to storage without navigating, so poll while the guest is on
    // screen and leave a restart something to restore. Hidden, the guest cannot gain a
    // sign-in, so the poll stops with the view instead of running against a hidden guest.
    if (snapshotTimer === null) snapshotTimer = window.setInterval(() => { void remember(); }, SNAPSHOT_INTERVAL_MS);
  };
  const stopTimer = () => {
    if (snapshotTimer !== null) { window.clearInterval(snapshotTimer); snapshotTimer = null; }
  };
  const show = async () => {
    if (disposed) return;
    visibleIntent = true;
    if (element === null) {
      opening ??= build().catch((error) => {
        // A guest that failed to build must not look built: drop the element and hand the
        // lease back, or the next switch acquires a second reservation while this one
        // leaks for the lifetime of the process.
        element?.remove();
        element = null;
        guestReady = false;
        releaseLease();
        throw error;
      }).finally(() => { opening = null; });
      try {
        await opening;
      } catch (error) {
        // A build cancelled by disposal is not a failure to fall back from.
        if (error === CANCELLED) return;
        throw error;
      }
    }
    // The view may have been put away (or the plugin disposed) while the lease round trip
    // was in flight: the built guest stays cached, but it must not reveal itself now.
    if (disposed || !visibleIntent) return;
    // Reveal only once there is something to show: acquiring the lease is a round trip,
    // and unhiding first paints the white backdrop over the content column meanwhile.
    watchLayout();
    applyInsets();
    refreshBack();
    host.hidden = false;
    startResizeWatch();
    startTimer();
  };
  const hide = () => {
    visibleIntent = false;
    host.hidden = true;
    stopTimer();
    stopResizeWatch();
    stopSettle();
    void remember();
  };
  const isVisible = () => !host.hidden;
  const toggle = async () => {
    if (isVisible()) { hide(); return; }
    try {
      await show();
    } catch (error) {
      if (error !== CANCELLED) throw error;
    }
  };
  // Two meanings, decided by where the guest is when the user clicks. Away from the
  // chat application the page in front was opened from a conversation, so the control
  // steps the guest back to that conversation; on the chat application there is nothing
  // left to go back to inside the view, so the control puts the view away and returns
  // to DSH.
  const returnToChat = () => {
    const view = element;
    // Only a ready guest can be asked, and only a ready guest can show a page that is not
    // the chat interface — onBack decides with guestUrl(), which reports "" until then.
    if (view === null || !guestReady) return;
    // The conversation is normally behind this page in the guest's own Chromium
    // history, and stepping back keeps the application's state instead of reloading it.
    if (typeof view.canGoBack === "function" && view.canGoBack()) { view.goBack(); return; }
    // History that cannot step back (a replaced entry, a guest that reports no
    // history) still lands on the last chat interface the guest showed.
    void view.loadURL(lastChat ?? CHAT_URL).catch((error) => {
      console.error("dsh-deepseek-chat: failed to return to the chat view", error);
    });
  };
  const onBack = () => {
    const view = element;
    const url = guestUrl();
    if (view !== null && isGuestPage(url)) { returnToChat(); return; }
    hide();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    visibleIntent = false;
    stopTimer();
    stopResizeWatch();
    stopSettle();
    layoutObserver?.disconnect();
    layoutObserver = null;
    frameElement = null;
    unsubscribeOpen?.();
    unsubscribeOpen = null;
    releaseLease();
    element?.remove();
    element = null;
    guestReady = false;
    host.remove();
  };
  back.addEventListener("click", onBack);
  // The switcher keeps one observer alive for brand remounts and asks the view to
  // re-apply its geometry after the host rebuilt the sidebar.
  const refreshLayout = () => {
    if (disposed || !isVisible()) return;
    watchLayout();
    applyInsets();
  };
  return { show, hide, toggle, isVisible, dispose, refreshLayout };
}

function createSwitcher(ctx) {
  // A non-standard boot could run this before the body exists; there is nothing to
  // decorate then, and the host re-mounts the plugin on the next composition.
  if (document.body === null) return () => {};
  const style = document.createElement("style");
  style.setAttribute("data-plugin", PLUGIN_ID);
  style.textContent = `
    /* The host's brand is a full-row control: .brand is flex:1 and spans the whole
       logo row, so chrome painted on the trigger itself draws a long empty band
       beside the wordmark. Paint the wordmark instead, which is what the pointer
       actually aims at. The negative margin cancels the padding so the mark does
       not move, and 4px matches the brand's own left inset, keeping the chip inside
       the row's overflow clip. */
    [${TRIGGER_ATTR}] > ${BRAND_IDENTITY_SELECTOR} { padding:2px 4px; margin:-2px -4px; border-radius:6px; }
    /* The host's own row hover fill, so the chip follows the light/dark theme
       instead of staying a light grey patch on a dark sidebar. */
    [${TRIGGER_ATTR}]:hover > ${BRAND_IDENTITY_SELECTOR} { background:var(--dsw-alias-interactive-bg-hover, #f0f0f0); }
    [${TRIGGER_ATTR}]:focus-visible { outline:none; }
    [${TRIGGER_ATTR}]:focus-visible > ${BRAND_IDENTITY_SELECTOR} { outline:2px solid #4d6bfe; outline-offset:-2px; }
    /* The view lands on the frame's content column: the insets are read from the
       frame at show time (readFrameInsets), so the caption strip and the sidebar
       stay in place. overflow:hidden lets the top-left radius clip the guest.
       The stacking order keeps the guest above the frame's in-flow content but
       below the host's portalled surfaces: menus sit at 1100, modals at 1000 and
       tooltips/toasts above 900, so host UI opened from a shortcut or a keyboard
       command is not painted behind the guest. */
    #${CHAT_VIEW_ID} { position:fixed; inset:0; z-index:900; background:#fff; overflow:hidden; }
    #${CHAT_VIEW_ID}[hidden] { display:none; }
    #${CHAT_VIEW_ID} webview { width:100%; height:100%; border:0; }
    /* Floating control in the lower-right, lifted clear of the guest's composer
       so it never covers the send button: a 42px circular hit area whose visible
       shape is the icon's own disc. The disc uses a deliberately light grey — the
       theme's secondary label colour reads as a dark blob against a white page. */
    #${CHAT_VIEW_BACK_ID} { position:absolute; right:24px; bottom:150px; z-index:10; display:inline-flex; align-items:center; justify-content:center; width:42px; height:42px; padding:0; border:0; border-radius:50%; background:transparent; color:#b0b5bd; cursor:pointer; filter:drop-shadow(0 1px 5px #0000001f); transition:color 120ms ease; }
    #${CHAT_VIEW_BACK_ID}:hover { color:#8b9199; }
    #${CHAT_VIEW_BACK_ID}:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary, #4d6bfe); outline-offset:2px; }
    #${CHAT_VIEW_BACK_ID} svg { display:block; width:100%; height:100%; }
  `;
  document.head.appendChild(style);
  // Web has no shell to host a guest, so it keeps the plain navigation.
  const chatView = IS_DESKTOP ? createChatView(ctx) : null;
  // The sidebar brand switches both ways: it stays clickable while the guest is
  // up, so the same logo that enters also returns.
  const toggleChat = () => {
    if (chatView === null) { window.location.assign(CHAT_URL); return; }
    void chatView.toggle().catch((error) => {
      chatView.hide();
      console.error("dsh-deepseek-chat: in-app view unavailable, opening the browser instead", error);
      if (window.open(CHAT_URL, "_blank") === null) {
        console.error("dsh-deepseek-chat: the browser blocked the fallback window");
      }
    });
  };
  let trigger = null;
  let original = null;
  const attributes = [TRIGGER_ATTR, "aria-label", "title", "role", "tabindex"];
  const swallowHostAction = (event) => {
    event.preventDefault();
    // Capture on the brand prevents the host React handlers from creating a session.
    event.stopImmediatePropagation();
  };
  const activate = (event) => {
    swallowHostAction(event);
    toggleChat();
  };
  const activateFromKeyboard = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    activate(event);
  };
  const detach = () => {
    if (trigger === null) return;
    for (const name of CAPTURE_EVENTS) trigger.removeEventListener(name, swallowHostAction, true);
    trigger.removeEventListener("click", activate, true);
    trigger.removeEventListener("keydown", activateFromKeyboard, true);
    for (const [name, value] of original) {
      if (value === null) trigger.removeAttribute(name); else trigger.setAttribute(name, value);
    }
    trigger = null;
    original = null;
  };
  // The sidebar unmounts the brand while collapsed (the host also auto-collapses below
  // 1024px) and mounts a fresh node on expand, so binding once would leave the title
  // inert after the first collapse — the new node would just start a new session.
  // Every mutation therefore re-checks whether the decorated node is still the host's;
  // rebinding is idempotent while the same node survives a re-render.
  const bind = () => {
    const next = findBrandButton();
    if (next === trigger) {
      // A host re-render or a locale switch re-applies its own aria-label; keep ours on
      // the node that survived instead of leaving the title announcing "new session".
      if (trigger !== null && trigger.getAttribute("aria-label") !== labelSwitch()) {
        trigger.setAttribute("aria-label", labelSwitch());
        trigger.setAttribute("title", labelSwitch());
      }
      return;
    }
    detach();
    trigger = next;
    if (trigger === null) return;
    original = attributes.map((name) => [name, trigger.getAttribute(name)]);
    trigger.setAttribute(TRIGGER_ATTR, "");
    trigger.setAttribute("aria-label", labelSwitch());
    trigger.setAttribute("title", labelSwitch());
    if (trigger.tagName !== "BUTTON") {
      // macOS Desktop: the brand is a window-drag span, not a button. A button
      // role and a tab stop opt it out of the shell's drag rule and keep it
      // keyboard reachable.
      trigger.setAttribute("role", "button");
      trigger.setAttribute("tabindex", "0");
    }
    for (const name of CAPTURE_EVENTS) trigger.addEventListener(name, swallowHostAction, true);
    trigger.addEventListener("click", activate, true);
    trigger.addEventListener("keydown", activateFromKeyboard, true);
  };
  // The sidebar and the caption strip stay live above the view, so a click there means
  // the user is driving the host rather than the guest. Put the view away first, or
  // whatever they opened — a session, settings, a window menu — is painted behind it and
  // looks like nothing happened. The brand is exempt: its own handler is the toggle.
  const onHostClick = (event) => {
    if (chatView === null || !chatView.isVisible()) return;
    const target = event.target;
    if (target === null || typeof target !== "object") return;
    if (typeof target.closest === "function" && target.closest("#" + CHAT_VIEW_ID) !== null) return;
    // Resolve the brand fresh: the bound node may already be detached by a collapse.
    const brand = findBrandButton();
    if (brand !== null && typeof brand.contains === "function" && brand.contains(target)) return;
    chatView.hide();
  };
  document.addEventListener("click", onHostClick, true);
  // Keep watching: the host unmounts and remounts the brand as the sidebar collapses and
  // expands, and rebuilding the sidebar replaces it as well. Rebinding is idempotent for
  // a node that survives, so this costs one querySelector per mutation.
  const observer = new MutationObserver(() => {
    bind();
    chatView?.refreshLayout();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  bind();
  return () => {
    observer.disconnect();
    document.removeEventListener("click", onHostClick, true);
    detach();
    chatView?.dispose();
    style.remove();
  };
}
function apply(ctx) {
  ctx.effect(() => createSwitcher(ctx), "dsh-deepseek-chat: sidebar product switch");
}
return { apply };
  }
});
