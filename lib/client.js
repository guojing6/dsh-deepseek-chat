window.__ModuleLoader__.load({
  id: "@guojing6/dsh-deepseek-chat",
  factory: (require) => {
// React is a shell shared-module entry: the right-sidebar tab body, its guide card and
// the session-header switch are all real slot occupants rather than DOM chrome.
const React = require("react");
const CHAT_ORIGIN = "https://chat.deepseek.com";
const CHAT_URL = CHAT_ORIGIN + "/";
// Every unknown path on this host answers with the application document itself, so the
// seed page has to be a path that really exists as a static file: this one is a tiny
// text/plain document that does not boot the application.
const CHAT_SEED_URL = CHAT_ORIGIN + "/robots.txt";
// Host-page storage key holding the last snapshot of the guest's storage.
const SESSION_KEY = "dsh-deepseek-chat:chat-session";
const SESSION_VERSION = 1;
const SNAPSHOT_INTERVAL_MS = 15000;
const SNAPSHOT_LIMIT = 200000;
// The entries the application needs to consider itself signed in. Everything else it
// keeps is a preference or a cache, so a large guest store may drop those but never these.
const SESSION_ESSENTIAL_KEYS = ["userToken", "__appKit_userInfo"];
// Right-sidebar page type, its implementation identity (also the body slot key) and the
// guide entry/command that open it.
const CHAT_TAB_KIND = "deepseek-chat";
const CHAT_TAB_ID = "@guojing6/dsh-deepseek-chat/tab";
const CHAT_COMMAND_ID = "deepseek-chat.open";
const CHAT_GUIDE_ENTRY_ID = "chat";
// Session-header utility order: official occupants start at -10 (Open in VSCode), so a
// large negative order keeps the switch at the far left of that row.
const SWITCH_BUTTON_ID = "dsh-chat-switch";
const SWITCH_ORDER = -100;
// The new-session (hero) screen hides the utilities row (`hideChrome`) and its corner slot
// is a single seat already held by the sidebar expand button, so the same button is also
// seated in the frame overlay, positioned by measurement just left of that button. A
// class-based style and distinct slot ids keep the instances from colliding when the phase
// flips (a DOM id would be duplicated for a frame).
const SWITCH_BUTTON_CLASS = "dsh-chat-switch-button";
const CORNER_LAYER_CLASS = "dsh-chat-corner-layer";
const CORNER_SWITCH_ID = "dsh-chat-switch-corner";
const BODY_CLASS = "dsh-deepseek-chat-body";
const GLYPH_CLASS = "dsh-deepseek-chat-glyph";
const TAB_TITLE_CLASS = "dsh-deepseek-chat-tabtitle";
const TAB_TITLE_ICON_CLASS = "dsh-deepseek-chat-tabtitle-icon";
const TAB_TITLE_TEXT_CLASS = "dsh-deepseek-chat-tabtitle-text";
const CHAT_TITLE = "DeepSeek Chat";
// The DeepSeek Chat mark (whale) from the site's own favicon, inlined so every occupant
// renders without a network request and keeps the brand colour in both themes.
const CHAT_LOGO_SVG = '<svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="#4D6BFE" fill-rule="nonzero" d="M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 34.4736 16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9.22363 14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 21.728C41.6426 21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 37.3838C10.7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 23.9678C27.0444 23.9678 27.1152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.0161 26.8633 23.0161C26.666 23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z"/></svg>';
// The Desktop shell serves the application window from dsh-app://app/ and its preload
// marks <html> with data-platform; the Web surface is http(s) and has neither.
const IS_DESKTOP = window.location.protocol === "dsh-app:"
  || document.documentElement.dataset.platform !== undefined;
// The host keeps <html lang> in sync with its locale service (zh-CN for Chinese), so the
// plugin's own copy can follow the interface language instead of being pinned to one.
const isChinese = () => String(document.documentElement.lang ?? "").toLowerCase().startsWith("zh");
const labelOpen = () => (isChinese() ? "打开 DeepSeek Chat" : "Open DeepSeek Chat");
const labelDescription = () => (isChinese() ? "在侧栏里与 DeepSeek Chat 对话" : "Chat with DeepSeek in the sidebar");

// Rebuild the standard Chromium user agent from the host agent: keep its platform clause
// and Chromium version, drop the Electron and product tokens that mark an embedded view
// (DeepSeek Chat answers those with an environment warning).
function standardUserAgent() {
  const source = navigator.userAgent;
  const platform = /\(([^)]*)\)/.exec(source)?.[1] ?? "Windows NT 10.0; Win64; x64";
  const chromium = /Chrome\/([\d.]+)/.exec(source)?.[1] ?? "130.0.0.0";
  return "Mozilla/5.0 (" + platform + ") AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + chromium + " Safari/537.36";
}

// DeepSeek Chat keeps its sign-in in localStorage (a `userToken` handle plus
// `__appKit_userInfo`) and marks the cookies that matter HttpOnly. The shell gives each
// workspace one in-memory partition (`dsh-sidebar-browser-<uuid>`, with no `persist:`
// prefix), so nothing inside the guest outlives the process and the page asks for a new
// sign-in on every restart. This mirrors the guest's storage into the application page's
// own localStorage — `dsh-app` is a standard, secure scheme on the persistent default
// session, so that copy does survive — and writes it back into a same-origin seed
// document before the application document boots, because the page reads its token once,
// at startup.
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
      // A single oversized cache must not crowd out the small entries after it, so the cap
      // only rejects the entry that would cross it.
      if (!required.includes(key) && size + key.length + value.length > ${SNAPSHOT_LIMIT}) continue;
      size += key.length + value.length;
      local[key] = value;
    }
  } catch (error) { return ""; }
  return JSON.stringify({ local, cookies: document.cookie || "" });
})()`;

// Writes a snapshot back into the guest's storage, returning the restored sign-in token so
// a failure to seed is visible rather than silent.
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

// A link in a DeepSeek Chat answer opens the way a transcript link does with the In-App
// Sidebar destination: a right-sidebar Browser tab beside the chat. Without that tab the
// page goes to the default browser, which is the host's own fallback for that destination.
function createLinkOpener(ctx) {
  return (url) => {
    try {
      const sidebarRight = ctx?.sidebarRight;
      const tabs = ctx?.sidebarRightTabs;
      const browserTab = typeof tabs?.get === "function" ? tabs.get("browser") : undefined;
      if (browserTab !== undefined && typeof sidebarRight?.openTab === "function") {
        sidebarRight.openTab("browser", { params: { url } });
        return;
      }
    } catch (error) {
      // The tab could not be opened; the external browser is the host's own fallback.
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };
}

// The embedded chat guest: one <webview> leased through the shell bridge on Desktop, one
// iframe on Web. It lives inside the right-sidebar tab body, so hidden means the tab lost
// focus, not that the guest is discarded (the tab type keeps its body mounted).
function createChatGuest(container, ctx) {
  const openLink = createLinkOpener(ctx);
  let disposed = false;
  let view = null;
  let lease = null;
  let leaseApi = null;
  let guestReady = false;
  let unsubscribeOpen = null;
  let timer = null;
  let stage = "bootstrap";
  const snapshot = readSession();

  const stopTimer = () => {
    if (timer !== null) { window.clearInterval(timer); timer = null; }
  };
  const startTimer = () => {
    // A sign-in is written to storage without navigating, so poll while the guest is
    // mounted and leave a restart something to restore.
    if (timer === null) timer = window.setInterval(() => { void remember(); }, SNAPSHOT_INTERVAL_MS);
  };
  const remember = () => {
    if (!guestReady || view === null) return Promise.resolve();
    let pending = null;
    try {
      pending = view.executeJavaScript(READ_STORAGE);
    } catch (error) {
      return Promise.resolve();
    }
    return Promise.resolve(pending).then((raw) => {
      if (typeof raw !== "string" || raw === "") return;
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (error) { return; }
      if (parsed === null || typeof parsed !== "object") return;
      const local = parsed.local !== null && typeof parsed.local === "object" ? parsed.local : null;
      // Only overwrite with a snapshot that still carries a sign-in: a failed load must not
      // wipe the token the next restart could have used.
      if (local === null || typeof local.userToken !== "string" || local.userToken === "") return;
      writeSession({
        version: SESSION_VERSION,
        origin: CHAT_ORIGIN,
        savedAt: Date.now(),
        local,
        cookies: typeof parsed.cookies === "string" ? parsed.cookies : "",
      });
    }).catch((error) => {
      console.error("dsh-deepseek-chat: could not snapshot the guest session", error);
    });
  };
  const releaseLease = () => {
    const api = leaseApi;
    if (lease !== null && api) void Promise.resolve(api.release(lease)).catch(() => {});
    lease = null;
    leaseApi = null;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stopTimer();
    unsubscribeOpen?.();
    unsubscribeOpen = null;
    void remember();
    releaseLease();
    view?.remove();
    view = null;
    guestReady = false;
  };
  const startWeb = () => {
    // Web has no shell guest; an iframe is the best available embedding (sites that refuse
    // frame embedding stay blank, which is why the Desktop path is the supported one).
    const frame = document.createElement("iframe");
    frame.className = "dsh-deepseek-chat-frame";
    frame.setAttribute("src", CHAT_URL);
    frame.setAttribute("referrerpolicy", "no-referrer");
    container.appendChild(frame);
    view = frame;
  };
  const startDesktop = () => {
    const api = window.dshDesktop?.browser;
    if (!api) {
      container.textContent = isChinese() ? "当前环境不支持内嵌 DeepSeek Chat。" : "This environment cannot embed DeepSeek Chat.";
      return;
    }
    leaseApi = api;
    void api.acquire("dsh-deepseek-chat").then((reservation) => {
      if (disposed) {
        void Promise.resolve(api.release(reservation.lease)).catch(() => {});
        return;
      }
      lease = reservation.lease;
      const guest = document.createElement("webview");
      // The bootstrap document carries the lease; the shell rejects a guest whose src or
      // partition does not match the reservation, and it requires the guest's first
      // dom-ready to still be on that bootstrap address.
      guest.setAttribute("name", reservation.lease);
      guest.setAttribute("partition", reservation.partition);
      guest.setAttribute("allowpopups", "");
      guest.setAttribute("src", "about:blank#" + reservation.lease);
      view = guest;
      const loadUrl = (url, onFailure) => {
        try {
          void guest.loadURL(url).catch((error) => {
            console.error("dsh-deepseek-chat: failed to open " + url, error);
            if (onFailure !== undefined) onFailure();
          });
        } catch (error) {
          console.error("dsh-deepseek-chat: failed to open " + url, error);
          if (onFailure !== undefined) onFailure();
        }
      };
      const enter = () => { stage = "app"; loadUrl(CHAT_URL); };
      guest.addEventListener("dom-ready", () => {
        guestReady = true;
        startTimer();
        if (stage === "bootstrap") {
          // The guest inherits the host user agent, whose Electron and product tokens make
          // the page treat this as an unofficial client. setUserAgent changes the guest
          // webContents directly, so it survives the shell clearing webPreferences in
          // will-attach-webview, and it happens before the real page loads.
          try { guest.setUserAgent(standardUserAgent()); } catch (error) {
            console.error("dsh-deepseek-chat: could not set the guest user agent", error);
          }
          if (snapshot === null) { enter(); return; }
          stage = "seed";
          loadUrl(CHAT_SEED_URL, enter);
          return;
        }
        if (stage === "seed") {
          stage = "app";
          guest.executeJavaScript(writeStorageScript(snapshot))
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
      guest.addEventListener("did-fail-load", (event) => {
        if (event?.errorCode === -3 || event?.isMainFrame === false) return;
        console.error("dsh-deepseek-chat: the chat guest failed to load", event?.errorCode, event?.errorDescription, event?.validatedURL);
      });
      // A link that asks for a new window always leaves the guest for the host: the Browser
      // tab beside it, or the default browser. The shell forwards only plain GET window-open
      // requests to http(s) destinations that are not the DSH host.
      unsubscribeOpen = api.onOpenRequested(reservation.lease, (url) => { openLink(url); });
      container.appendChild(guest);
    }).catch((error) => {
      console.error("dsh-deepseek-chat: could not open the DeepSeek Chat guest", error);
      if (!disposed) container.textContent = isChinese() ? "打开 DeepSeek Chat 失败。" : "Could not open DeepSeek Chat.";
    });
  };
  return {
    start() { if (IS_DESKTOP) startDesktop(); else startWeb(); },
    dispose,
  };
}

// The right-sidebar tab body. The tab type keeps it mounted across tab switches, so the
// bound ref is the whole lifecycle: it creates the guest on attach and disposes it on
// detach (closing the tab or unloading the plugin).
function createChatBody(ctx) {
  return function ChatBody(props) {
    const useTabInfo = props.useTabInfo;
    const info = typeof useTabInfo === "function" ? useTabInfo() : undefined;
    const tabId = info?.tab?.id ?? "deepseek-chat";
    const guest = React.useRef(null);
    const attach = React.useCallback((element) => {
      if (element === null) {
        guest.current?.dispose();
        guest.current = null;
        return;
      }
      if (guest.current !== null) return;
      guest.current = createChatGuest(element, ctx);
      guest.current.start();
    }, [tabId]);
    return React.createElement("div", { className: BODY_CLASS, "data-tab-id": tabId, ref: attach });
  };
}

// The session-header switch: a 28px icon button carrying the DeepSeek Chat mark, at the
// far left of the header utilities row (Open in VSCode, session log, feedback follow it).
// The same component is also registered in the hero options row on the new-session screen.
function createSwitchButton(openChat) {
  return function ChatSwitchButton() {
    return React.createElement("button", {
      type: "button",
      className: SWITCH_BUTTON_CLASS,
      "aria-label": labelOpen(),
      title: labelOpen(),
      onClick: openChat,
      dangerouslySetInnerHTML: { __html: CHAT_LOGO_SVG },
    });
  };
}

// The overlay seat for the new-session screen. It measures the sidebar expand button's
// container and renders the switch immediately left of it (vertically centred), but only
// while the conversation root reports `data-phase="hero"` — the overlay itself is mounted
// on every screen, so it must hide itself everywhere else.
function createCornerSwitch(openChat) {
  return function ChatCornerSwitch() {
    const layer = React.useRef(null);
    const [box, setBox] = React.useState(null);
    React.useEffect(() => {
      const measure = () => {
        const host = layer.current;
        const corner = document.querySelector("[data-conversation-header-corner]");
        const hero = document.querySelector('[data-phase="hero"]') !== null;
        if (host === null || !hero || corner === null) { setBox(null); return; }
        const outer = host.getBoundingClientRect();
        const rect = corner.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) { setBox(null); return; }
        const size = 28;
        setBox({
          left: Math.round(rect.left - outer.left - 8 - size),
          top: Math.round(rect.top - outer.top + (rect.height - size) / 2),
        });
      };
      measure();
      const observer = new MutationObserver(measure);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden", "data-phase"] });
      window.addEventListener("resize", measure);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", measure);
      };
    }, []);
    return React.createElement("div", { ref: layer, className: CORNER_LAYER_CLASS },
      box === null ? null : React.createElement("button", {
        type: "button",
        className: SWITCH_BUTTON_CLASS,
        style: { position: "absolute", left: box.left + "px", top: box.top + "px" },
        "aria-label": labelOpen(),
        title: labelOpen(),
        onClick: openChat,
        dangerouslySetInnerHTML: { __html: CHAT_LOGO_SVG },
      }));
  };
}

// Guide-card artwork: the same mark in the guide's own icon box. The guide passes its
// glyph size (22 without a description, 26 with one), so the mark scales to it.
function ChatGuideIcon(props) {
  const size = typeof props?.size === "number" ? props.size : 24;
  return React.createElement("span", {
    className: GLYPH_CLASS,
    style: { width: size + "px", height: size + "px" },
    dangerouslySetInnerHTML: { __html: CHAT_LOGO_SVG },
  });
}

// The tab chip's title seat. Without a seat the chip falls back to the captured title as
// plain text (no mark, and an extra truncation layer); the first-party Browser tab
// registers this same seat to draw its icon and page name. The label keeps the full title
// in its tooltip for chips narrow enough to ellipsize.
function ChatTabTitle(props) {
  const info = typeof props?.useTabInfo === "function" ? props.useTabInfo() : undefined;
  const title = typeof info?.tab?.title === "string" && info.tab.title !== "" ? info.tab.title : CHAT_TITLE;
  return React.createElement("span", { className: TAB_TITLE_CLASS, title },
    React.createElement("span", { className: TAB_TITLE_ICON_CLASS, dangerouslySetInnerHTML: { __html: CHAT_LOGO_SVG } }),
    React.createElement("span", { className: TAB_TITLE_TEXT_CLASS }, title));
}

function createSwitcher(ctx) {
  // A non-standard boot could run this before the body exists; there is nothing to attach
  // then, and the host re-mounts the plugin on the next composition.
  if (document.body === null) return () => {};
  const style = document.createElement("style");
  style.setAttribute("data-plugin", "@guojing6/dsh-deepseek-chat");
  style.textContent = `
    /* The switch matches the host's own icon buttons: a 28px hit area, the theme's
       secondary label colour and the shared hover/focus tokens. Styled by class because
       two instances (header utilities + hero overlay) may mount while the phase flips. */
    .${SWITCH_BUTTON_CLASS} { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; padding:0; border:0; border-radius:var(--dsw-radius-sm, 6px); background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; flex:none; }
    .${SWITCH_BUTTON_CLASS}:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
    .${SWITCH_BUTTON_CLASS}:focus-visible { outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe)); outline-offset:-2px; }
    .${SWITCH_BUTTON_CLASS} svg { display:block; width:18px; height:18px; }
    /* The hero overlay layer fills the frame without taking pointer events; only the
       button itself is clickable, and it is placed by measurement next to the expand
       button of the sidebar. */
    .${CORNER_LAYER_CLASS} { position:absolute; inset:0; pointer-events:none!important; }
    .${CORNER_LAYER_CLASS} .${SWITCH_BUTTON_CLASS} { position:absolute; pointer-events:auto; }
    /* The tab body fills its pane the way the first-party Browser tab does: the seat
       (SidebarRight's tabBody) is a flex column, so the body claims the remaining height
       through flex, and the guest claims the body's height in turn. Percentage heights
       collapse when the seat derives its own height from flex, which is what rendered the
       embedded page as a short strip. The guest rules mirror the Browser tab's own webview
       style (flex:auto + 100% width/height + no-drag) so both embedding modes size alike. */
    .${BODY_CLASS} { flex:auto; display:flex; width:100%; height:100%; min-width:0; min-height:0; overflow:hidden; background:#fff; }
    .${BODY_CLASS} webview, .${BODY_CLASS} iframe { -webkit-app-region:no-drag; display:flex; flex:auto; width:100%; height:100%; min-width:0; min-height:0; border:0; }
    .${GLYPH_CLASS} { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; }
    .${GLYPH_CLASS} svg { display:block; width:100%; height:100%; }
    /* The tab chip: the mark stays put, the label takes the remaining width and ellipsizes
       only when the sidebar is too narrow for it (the full title stays in its tooltip). */
    .${TAB_TITLE_CLASS} { display:inline-flex; align-items:center; gap:6px; min-width:0; max-width:100%; }
    .${TAB_TITLE_ICON_CLASS} { display:inline-flex; align-items:center; justify-content:center; flex:none; width:14px; height:14px; }
    .${TAB_TITLE_ICON_CLASS} svg { display:block; width:100%; height:100%; }
    .${TAB_TITLE_TEXT_CLASS} { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  `;
  document.head.appendChild(style);

  const openChat = () => {
    const sidebarRight = ctx?.sidebarRight;
    // The tab type is registered on the same service; without it there is nothing to open
    // in the sidebar, so the page goes to the default browser instead.
    if (typeof sidebarRight?.openTab !== "function") {
      window.open(CHAT_URL, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      sidebarRight.openTab(CHAT_TAB_KIND);
    } catch (error) {
      console.error("dsh-deepseek-chat: could not open the right-sidebar tab", error);
    }
  };

  const disposers = [];
  // Session-header switch (the same entry point as before, now opening the right-sidebar
  // tab instead of taking the main content column over).
  if (typeof ctx?.slots?.inject === "function" && typeof ctx?.slots?.register === "function") {
    disposers.push(ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
      name: "conversation.session.header.utilities",
      id: SWITCH_BUTTON_ID,
      order: SWITCH_ORDER,
    }, createSwitchButton(openChat))));
  } else {
    console.error("dsh-deepseek-chat: the host exposes no session header slot, so the switch has no button");
  }
  // The new-session screen renders the session header with `hideChrome` (utilities row not
  // mounted) and its corner is a single seat already held by the sidebar expand button, so
  // the switch gets the frame overlay seat instead and positions itself next to that
  // button. It only renders while the conversation root reports `data-phase="hero"`.
  if (typeof ctx?.slots?.inject === "function" && typeof ctx?.slots?.register === "function") {
    disposers.push(ctx.slots.inject("shell.overlay", () => ctx.slots.register({
      name: "shell.overlay",
      id: CORNER_SWITCH_ID,
      order: 0,
    }, createCornerSwitch(openChat))));
  }
  // The right-sidebar tab type: one guide card, plus a page type opened by kind.
  if (typeof ctx?.sidebarRightTabs?.register === "function") {
    disposers.push(ctx.sidebarRightTabs.register({
      id: CHAT_TAB_ID,
      kind: CHAT_TAB_KIND,
      priority: "extension",
      title: () => CHAT_TITLE,
      keepMounted: true,
      guide: [{
        id: CHAT_GUIDE_ENTRY_ID,
        commandId: CHAT_COMMAND_ID,
        order: 35,
        title: () => CHAT_TITLE,
        description: labelDescription,
        icon: ChatGuideIcon,
      }],
    }));
  } else {
    console.error("dsh-deepseek-chat: the host exposes no right-sidebar tab registry");
  }
  // The tab body is keyed by the type's id, exactly like a first-party provider.
  if (typeof ctx?.slots?.inject === "function" && typeof ctx?.slots?.register === "function") {
    disposers.push(ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
      name: "sidebar.right.pane.tab",
      key: CHAT_TAB_ID,
    }, createChatBody(ctx))));
    // The chip title seat: the fallback chip would show the captured title as plain text,
    // so this is what adds the whale mark next to the label.
    disposers.push(ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
      name: "sidebar.right.pane.tab.title",
      key: CHAT_TAB_ID,
    }, ChatTabTitle)));
  }
  // Ctrl+Q (⌘⌥Q on macOS, where ⌘Q quits) opens or focuses the tab. The guide card shows
  // the effective binding inline because the entry names this command.
  if (typeof ctx?.inject === "function") {
    try {
      ctx.inject(["shortcuts"], (scope) => {
        disposers.push(scope.shortcuts.register({
          id: CHAT_COMMAND_ID,
          label: () => CHAT_TITLE,
          aliases: ["deepseek chat", "deepseek", "chat"],
          defaults: {
            // Windows is the supported desktop target: Ctrl+Q. macOS uses ⌘⌥Q because ⌘Q
            // is the system quit chord. Desktop Linux and Web leave the command unbound:
            // the host's shortcut layer reserves primary+Q outside Windows/macOS Desktop,
            // and an unbound action can still be assigned from the host's settings.
            "desktop:windows": { code: "KeyQ", modifiers: ["primary"] },
            "desktop:macos": { code: "KeyQ", modifiers: ["primary", "alt"] },
          },
          regions: ["page", "editable", "terminal"],
          modals: [],
          resolve: ({ target }) => {
            const sidebarRight = ctx?.sidebarRight;
            if (typeof sidebarRight?.commandTarget === "function" && sidebarRight.commandTarget(target) === undefined) {
              return { status: "blocked", reason: isChinese() ? "先打开一个会话" : "Open a session first" };
            }
            return { status: "handled", run: () => { openChat(); } };
          },
        }));
      });
    } catch (error) {
      console.error("dsh-deepseek-chat: could not register the Ctrl+Q shortcut", error);
    }
  }
  return () => {
    for (const dispose of disposers.reverse()) {
      try { dispose?.(); } catch (error) { console.error("dsh-deepseek-chat: teardown step failed", error); }
    }
    style.remove();
  };
}

function apply(ctx) {
  ctx.effect(() => createSwitcher(ctx), "dsh-deepseek-chat: right-sidebar DeepSeek Chat");
}
// The tab body and header switch are slot occupants, and the type/tab navigation lives on
// the right-sidebar services, so the client fiber waits for them before it runs.
const inject = ["slots", "sidebarRight", "sidebarRightTabs"];
return { apply, inject };
  }
});
