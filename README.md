# @guojing6/dsh-deepseek-chat

[![npm](https://img.shields.io/npm/v/@guojing6/dsh-deepseek-chat?label=npm&color=4d6bfe)](https://www.npmjs.com/package/@guojing6/dsh-deepseek-chat)

DeepSeek Harness **Desktop** 客户端插件（desktop profile）：把 **DeepSeek Chat** 放进 DSH 的**右侧栏**，与对话并排使用。**只在 DSH Desktop 生效；Web 端不注册任何 UI。**

**npm 包**：`@guojing6/dsh-deepseek-chat`（当前 `3.1.3`，`latest`），可直接用 `dsh plugin --profile desktop add @guojing6/dsh-deepseek-chat` 安装；也可以从源码安装。详见[安装](#安装)。

| 入口 | 结果 |
| --- | --- |
| 会话头部工具区最左侧的 DeepSeek Chat 鲸鱼按钮（「用 VSCode 打开 / 下载会话日志 / 反馈」的左边） | 在右侧栏打开（或聚焦）DeepSeek Chat 标签页 |
| 新会话界面（还没开始对话）右上角、打开侧边栏按钮的左边 | 同上（该界面不渲染会话头部工具区，所以按钮通过 frame overlay 定位在展开按钮左侧） |
| 点「打开侧边栏」后开始界面里的 **DeepSeek Chat** 卡片（工作区文件、新建终端、浏览器、会话数据诊断之间） | 同上：在右侧栏打开 DeepSeek Chat 标签页 |
| **Ctrl+Q**（Windows Desktop；macOS 为 ⌘⌥Q；Desktop Linux 默认不绑定） | 同上；没有打开会话时命令被阻止并在快捷键列表里说明原因 |

右侧栏标签页的标题是 `DeepSeek Chat`，切到别的标签再切回来不会重新加载（`keepMounted`），登录态与页面状态都保留。回答里的网页链接交给 DSH——固定进右侧栏的 Browser 标签，不占用 chat 标签页。

**兼容性（2026-11-01 核对）**：按 DSH **0.2.1-rc.5**（打包 Desktop，Electron 44）核对宿主契约。插件只在 Desktop 激活；DSH 的客户端模块 `platform` 字段只接受 `"web"`（Desktop 与 Web 共用同一份前端 bundle），所以“仅 Desktop”是在运行时用 `dsh-app://` / `data-platform` 判定的，不是 manifest 字段。DSH 的兼容性闸门与 dshmarket 只读取 `package.json` 的 **`engines.dsh`**（或 `@deepseek-ai/dsh*` 的 `peerDependencies`），`dsh.compatibility` 不是宿主认识的字段——之前写在那里的 `dshReleases` 宿主完全忽略，dshmarket 因此显示「未声明宿主要求」。本插件现在声明：

```json
"engines": { "dsh": ">=0.2.1-alpha.3 <0.2.2-0" }
```

覆盖 0.2.1 alpha.3 ~ rc.5（含 0.2.1 正式版）。0.2.2 及以后不在声明范围内，DSH 会拒绝加载；要支持新版本，先按新版契约复核，再放宽这个范围。

- **2.1.0 / 2.2.0**：修掉从侧边栏品牌向上找 frame 的老 bug；回答里的链接改走 DSH 的打开方式（右侧栏 Browser 标签）。桌面壳一侧（`dshDesktop` 桥、guest 租约/attach 校验、分区与持久化、`data-platform`）在 alpha.3 → rc.5 之间未变。
- **2.3.0**：开关从「劫持侧边栏品牌」改成官方扩展点，注册到 `conversation.session.header.utilities`（`order: -100`，最左），并换用 DeepSeek Chat 的鲸鱼 logo。
- **3.0.0**：**主版本：DeepSeek Chat 迁移进右侧栏**（入口与交互方式都变了，所以升大版本）。不再用浮层盖住主内容列、也不再有自己的返回圆按钮：改为注册右侧栏标签页类型（`ctx.sidebarRightTabs.register`）、标签页正文（`sidebar.right.pane.tab` 槽位）与 `Ctrl+Q` 命令；开始界面新增 DeepSeek Chat 卡片。旧的全屏内嵌视图、frame 几何测量与圆按钮全部删除。标签页正文按自带 Browser 标签的 flex 尺寸链铺满面板。
- **3.0.1**：仅文档更新——README 增加「已发布到 npm」说明与 npm 安装方式；无代码变更。
- **3.0.2**：GitHub 用户名由 `Guojing6` 改为 `guojing6`，同步更新 README 里的 clone 地址与 `package.json` 的 repository/homepage/bugs 链接；无代码变更。
- **3.1.0**：标签页 chip 注册自己的 title seat——标题左侧显示 DeepSeek Chat 鲸鱼 logo，标题文字单独占位（空间不足时才省略，完整标题保留在 tooltip 里）。
- **3.1.1**：新会话界面（hero）也显示 DeepSeek Chat 按钮——该界面用 `hideChrome` 渲染会话头部、不挂载 utilities 行，所以把同一个按钮额外注册到 `conversation.hero.options`（两个槽位按阶段互补，不会重复）；按钮改用 class 样式避免两实例短暂并存时出现重复 DOM id。
- **3.1.2**：新会话界面的按钮改到**打开侧边栏按钮的左边**——`corner` 是 single 槽且已被展开按钮占用，不能直接加第二个，因此改注册到 `shell.overlay`，运行时测量展开按钮位置把按钮吸附到它左侧，并且只在 `data-phase="hero"` 时显示。
- **3.1.3**：修兼容性声明——DSH 只认 `engines.dsh`，原来的 `dsh.compatibility.dshReleases` 宿主完全忽略，dshmarket 显示「未声明宿主要求」。改为 `engines.dsh: ">=0.2.1-alpha.3 <0.2.2-0"`；**只保留 Desktop 端**：chat.deepseek.com 的 `frame-ancestors 'none'` 使 Web 内嵌不可能，插件在 Web surface 上直接不激活、不注册任何 UI，删掉 iframe/提示分支；guest 首个 `dom-ready` 的导航延后一个微任务，让壳先登记租约；右侧栏打不开时回退系统浏览器。

## 安装

插件发布在 [npm](https://www.npmjs.com/package/@guojing6/dsh-deepseek-chat)（`latest` = `3.1.3`）。只安装到 **desktop** profile；Web profile 即使装上也不会注册任何 UI。

### 方式一：从 npm 安装（推荐）

```sh
# Desktop：先启动一次 Desktop 初始化其 profile，完全退出后再执行
dsh plugin --profile desktop add @guojing6/dsh-deepseek-chat
```

需要固定版本时写成 `@guojing6/dsh-deepseek-chat@3.1.3`；升级用 `dsh plugin --profile desktop add @guojing6/dsh-deepseek-chat@latest`（`dsh plugin` 会把参数转发给 profile 目录里的 pnpm，所以 pnpm 的 `@version` / `@latest` 语法都可用）。npm 包内只包含 `lib/client.js`、`lib/index.js`、`cordis.patch.yml`、`README.md` 与 `LICENSE`。

> npm 的版本列表里还能看到一个 `0.0.0-stage`：这是 npm 对「新包首次发布」的占位版本（staged creation 的公开占位），内容为空、不参与安装；`latest` 指向 `3.1.3`，忽略即可。

### 方式二：从源码安装（开发/离线）

```sh
git clone https://github.com/guojing6/dsh-deepseek-chat.git

dsh plugin --profile desktop add ./dsh-deepseek-chat
```

`dsh plugin` 会在 profile 目录里转发给 pnpm，所以本地目录也可以直接给绝对路径（例如 `dsh plugin --profile desktop add E:/workspace/dsh-deepseek-chat`，profile 里会记成 `link:`），卸载用 `dsh plugin --profile desktop remove @guojing6/dsh-deepseek-chat`。

Desktop 安装后重新打开应用（关闭窗口只是收进托盘，需要从托盘完全退出）。Desktop 也可用其自带的 `resources/runtime/cli/bin/dsh` 执行同样的命令。

安装后如果「看起来没有装上」——会话头部没有鲸鱼按钮、右侧栏开始界面没有 DeepSeek Chat 卡片、Ctrl+Q 没反应——先确认三处：profile 的 `package.json` 里 **`dsh.profile.bundles` 必须包含 `@guojing6/dsh-deepseek-chat`**（只出现在 `dependencies` 里不够）；profile 的 `cordis.patch.yml` 必须出现插件 bundle patch 插入的 `chat-entry` 行；启动器报错里没有插件激活失败（本插件注入 `slots`、`sidebarRight`、`sidebarRightTabs`，任一服务缺失都不会激活）。若早先以 `dsh-deepseek-chat`（无 scope）装过，profile 里会残留一个指向同一目录的 `link:` 依赖，与新的 `@guojing6/...` 包名冲突，需要先清掉再重装：

```sh
dsh plugin --profile desktop remove dsh-deepseek-chat
dsh plugin --profile desktop add E:/workspace/dsh-deepseek-chat
```

（卸载旧包名可能因为 link 与包名不一致而失败，此时直接编辑 profile 的 `package.json` 删掉那一行 `"dsh-deepseek-chat": "link:…"`，再执行 add。）

## 右侧栏：DeepSeek Chat 标签页

这是 DSH 的一等扩展点，不是画在页面上的 DOM：

- **标签页类型**：`ctx.sidebarRightTabs.register({ id, kind: 'deepseek-chat', priority: 'extension', title: () => 'DeepSeek Chat', keepMounted: true, guide: [...] })`。`id` 同时是正文槽位的 key；`keepMounted` 让标签页在切走时保留 guest（只隐藏、不销毁），切回来是原页面。
- **开始界面卡片**：`guide: [{ id: 'chat', commandId: 'deepseek-chat.open', order: 35, title, description, icon }]`。`order: 35` 落在「浏览器」(30) 与「会话数据诊断」之间；卡片右侧直接显示该命令的当前快捷键。卡片由 DSH 渲染并在点击时 `openTab(kind, { replaceTab: true })`，所以从开始界面打开后卡片自动让位给标签页。
- **正文**：注册 `sidebar.right.pane.tab` 槽位，`key` 等于类型 `id`。组件拿到框架注入的 `useTabInfo`，用一个 ref 承载容器：挂载时申请 guest 并塞进去，卸载（关标签页 / 停用插件）时释放租约。
- **快捷键**：`ctx.shortcuts.register({ id: 'deepseek-chat.open', defaults: { 'desktop:windows': Ctrl+Q, 'desktop:macos': ⌘⌥Q }, regions: ['page', 'editable', 'terminal'], resolve })`。Windows Desktop 是 **Ctrl+Q**；macOS 用 **⌘⌥Q**（⌘Q 是系统退出，故意避开）；Desktop Linux 默认不绑定——DSH 的快捷键层在 Windows/macOS Desktop 之外把 primary+Q 视为系统保留组合——命令仍出现在快捷键设置里，可自行指派。在输入框和终端里也能用。没有打开会话时 `resolve` 返回 `blocked`，命令面板里会说明「先打开一个会话」。
- **会话头部按钮**：保留 2.3.0 的 `conversation.session.header.utilities`（`order: -100`）鲸鱼按钮，点击等价于打开/聚焦这个标签页；右侧栏服务不可用时退回系统浏览器。

### Desktop：内嵌 guest

右侧栏里是真正的 `chat.deepseek.com`，通过主应用文档上的 `window.dshDesktop.browser` 申请 guest 租约后放进 `<webview>`：

- 申请租约 → `src="about:blank#<lease>"` 的 bootstrap 文档 → 壳校验 `src`/`partition`/owner 与「单次 attach」，并要求**第一个 `dom-ready` 时地址仍是 bootstrap 地址**。
- `dom-ready` 后先 `setUserAgent()` 换成标准 Chromium UA（guest 默认继承带 Electron 与产品标识的 UA，DeepSeek Chat 会据此弹出「使用环境异常」警告），再加载 `https://chat.deepseek.com/`。
- 从这里点出的网页链接走 `onOpenRequested`：右侧栏有 Browser 标签时用 `ctx.sidebarRight.openTab('browser', { params: { url } })` 在旁边新开，否则 `window.open` 交给系统浏览器。壳只转发纯 GET 的 http(s) 新窗口请求，POST、`mailto:` 等会被壳直接拦下。
- 权限一律被拒绝、**下载被禁止**、guest 内不能访问 DSH 自身服务地址——这些都是壳的 guest 策略，插件绕不开。

### 登录态

DeepSeek Chat 的登录凭证在 localStorage（`userToken` 与 `__appKit_userInfo`），重要 cookie 是 HttpOnly。壳给每个 workspace 一个**内存**分区（`dsh-sidebar-browser-<uuid>`，没有 `persist:` 前缀），所以 guest 里的登录态不跨进程。插件把 guest 的 localStorage 镜像进主应用页自己的 localStorage（`dsh-app` 是 standard + secure 协议、跑在持久的 default session 上，能跨重启），下次启动先用同源静态页 `/robots.txt`（不启动应用）把凭证写回 guest，再进首页——顺序不能反，应用只在启动时读一次 token。HttpOnly cookie 读不到也写不回；**若 DeepSeek 改为纯 cookie 认证，这条路径会失效**。

## 已知问题与限制

### 一、由 DSH 壳的 guest 策略决定（插件只能绕开）

- **分区不持久**：见上文镜像；若 DeepSeek 改认证方式则失效。官方侧栏浏览器没有这层镜像，仍然每次重启都要重登。
- **权限/下载被拒**：通知、剪贴板、设备权限、下载一律不可用。
- **依赖内部桥**：`window.dshDesktop.browser`（`protocolVersion: 1`）未对第三方公开承诺，升级后可能变；不可用时正文显示「当前环境不支持内嵌 DeepSeek Chat」。

### 二、依赖宿主扩展点（DSH 改版可能失效）

- **标签页/快捷键契约**：`ctx.sidebarRightTabs.register` 的字段形状（`id/kind/priority/title/guide/keepMounted`）、`guide` 条目字段（`id/commandId/order/title/description/icon`）、`sidebar.right.pane.tab` 槽位与 `useTabInfo` 注入、`ctx.shortcuts.register` 的 `defaults/resolve` 形状都照抄 0.2.1-rc.5 的 `sidebar-right` / `sidebar-browser`。宿主若改这些形状，表现是卡片/标签页/快捷键之一消失或报错。
- **兼容性只认 `engines.dsh`**：`dsh.compatibility` 不是 DSH 的字段，宿主和 dshmarket 都不会读；本插件已改用 `engines.dsh`。宿主升到 0.2.2 后会被 DSH 的兼容性闸门拒绝加载（这是声明范围的预期行为），需要先复核新版契约再放宽范围。
- **开始界面卡片只在有会话时出现**：右侧栏按会话 id 存状态（官方说明「No surface without a session」），首页/新建会话页没有右侧栏，因此也没有卡片。开始界面卡片顺序基于 DSH 的内建 `order`（工作区文件 10、新建终端 20、浏览器 30、本插件 35），DSH 调整顺序时可能变化。
- **`useTabInfo` 是框架注入的**：正文组件从 props 读它拿 `tab.id`；若 DSH 改名，正文仍能渲染，但 tab 切换时的复用判断会退化为固定值（guest 仍在，只是不按 tab 重建）。
- **鲸鱼 logo 是内联的站点 favicon**：取自 chat.deepseek.com 的 `favicon.svg`（#4D6BFE），不联网、不随站点更新；DeepSeek 换品牌时需手动替换。
- **会话头部按钮同样依赖槽位**：`conversation.session.header.utilities` 改名则按钮消失（不影响右侧栏卡片与快捷键）。

### 三、本实现自身的取舍

- **只支持 DSH Desktop**：Web surface 上插件直接不激活（不注册槽位、标签页、快捷键，也不注入样式）。原因是 chat.deepseek.com 返回 `Content-Security-Policy: frame-ancestors 'none'`，任何网页都无法内嵌它；而 DSH 的客户端模块 `platform` 字段只接受 `"web"`，无法在 manifest 层单独声明“仅 Desktop”。
- **标签页保留 = 内存常驻**：`keepMounted` 下每个打开过的 chat 标签页各自持有一个 guest 进程；关掉标签页即释放租约，插件停用也会释放。
- **只有打开过一个会话才能用**：右侧栏与快捷键都按会话工作，没有会话时命令被阻止。
- **链接固定进 Browser 标签，不跟随个人偏好**：无论「设置 → 通用 → 打开聊天链接」怎么选，chat 里的链接都走右侧栏 Browser（没有该标签时才用系统浏览器）——因为 chat 已经在侧栏里，网页放在旁边最接近 DSH 的默认体验。
- **登录态镜像多存了一份明文 token**：快照在 `dsh-app://app` 源的 localStorage（键 `dsh-deepseek-chat:chat-session`），同应用内的其他插件都读得到；卸载插件不会自动清掉。镜像只在读出 `userToken` 时覆盖，避免一次加载异常冲掉还能用的 token；登出后旧快照会留到下次启动、被恢复一次再由服务端判定失效。
- **有快照时多一次同源导航**：`about:blank → /robots.txt → 首页`，多一个极小的静态请求；种子页加载失败就直接进首页，本次不恢复、快照保留待下次。
- **这套镜像逻辑未在真机验证**：快照/恢复两段 guest 脚本用 Node + 桩 DOM 做过往返测试（含超长键裁剪、版本与来源校验），但「DeepSeek 登录后确实只靠 localStorage 恢复」只能在桌面端实测确认。

## 实现

- `lib/client.js`：只在 Desktop 激活。通过 `ctx.sidebarRightTabs.register` 注册类型与开始界面卡片，通过 `ctx.slots.register` 注册正文（`sidebar.right.pane.tab`，key = 类型 id）与会话头部鲸鱼按钮（`conversation.session.header.utilities`，order -100），通过 `ctx.inject(["shortcuts"], …)` 注册 `deepseek-chat.open`（Ctrl+Q）。bundle 注入 `slots`、`sidebarRight`、`sidebarRightTabs` 三个服务，停用时逆序撤回全部注册并移除样式。
- 正文：`createChatGuest(container, ctx)` 管一个 guest 的完整生命周期——Desktop 申请租约、创建 bootstrap `<webview>`、首个 `dom-ready` 后延后一个微任务换 UA 并进入首页、按需走 `/robots.txt` 写回快照、每 15 秒镜像一次 guest 登录态、`onOpenRequested` 把链接交给 Browser 标签；卸载时记一次快照、退租、移除元素、清定时器。Web surface 不创建正文，也不注册任何 UI。
- 登录镜像脚本：`READ_STORAGE` 读 guest localStorage（超长非关键键按 200 KB 上限裁掉，`userToken`/`__appKit_userInfo` 永不裁）并带上 `document.cookie`；`writeStorageScript` 在种子页回写并返回恢复到的 token；宿主快照带 `version`/`origin`/`savedAt`，`readSession` 校验版本与来源才使用。
- `lib/index.js`：空服务端入口；`cordis.patch.yml`：向 DSH 的 profile roster 注册 `chat-entry`，`name` 必须与 `package.json` 的 `name` 一致。

## 检查

```sh
npm run check   # 语法检查（node --check lib/client.js && lib/index.js）
npm test        # 24 个用例（node --test，无外部依赖）
# 沙箱禁止子进程时（node --test 报 spawn EPERM）：
npm run test:sandbox   # 等价于 node --test --test-isolation=none
```

`test/session.test.mjs` 用桩 DOM 加载插件本体，覆盖：兼容性声明（`engines.dsh` 存在、`dsh.compatibility` 不存在）、guest 存储快照的裁剪/异常上报、快照回写与失败上报、宿主侧快照的版本与来源校验；**激活冒烟测试**——直接跑真实源码的 `apply`，断言右侧栏类型注册（id/kind/priority/keepMounted/guide 卡片顺序与 commandId/图标）、正文与 chip 标题两个槽位 key、chip 标题组件（鲸鱼 logo + 文字 + tooltip）、新会话 overlay 按钮槽位（独立 id，hero 阶段外自动隐藏）、会话头部按钮仍在 `order < -10` 的最左位置、`Ctrl+Q` 命令的默认绑定与「无会话被阻止」、右侧栏打不开时回退系统浏览器、Web surface 上完全惰性（零注册、零样式）、语言跟随、样式表归属、停用后注册与样式全部撤回；以及**标签页 guest**——挂载正文时申请租约并塞入 bootstrap `<webview>`、卸载时退租与移除、首个 `dom-ready` 先让壳登记租约再换 UA 并进首页、有快照时先走种子页并回写、链接进 Browser 标签或回退系统浏览器、重复 ref 不重复建 guest。桩 guest 照抄 Electron 的契约：**`dom-ready` 之前任何方法都抛错**。
