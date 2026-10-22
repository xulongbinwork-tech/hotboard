/* HotBoard 前端逻辑：行业 tabs + 子分类 + AI 目录 + localStorage 配置（aihot 风格界面） */

const STORAGE_KEY = "hotboard_config_v3";
const CATEGORIES = ["新闻", "工具", "模型", "Agent", "社区"];

/** 默认配置：第一次打开时预置「AI」行业（ai-hot 风格的 AI 资讯源），不再是白板 */
const DEFAULT_CONFIG = {
  active: "AI",
  industries: {
    AI: {
      sources: [
        { name: "量子位", url: "https://www.qbitai.com/feed", cat: "新闻" },
        { name: "InfoQ 中文", url: "https://www.infoq.cn/feed", cat: "新闻" },
        { name: "Hugging Face 博客", url: "https://huggingface.co/blog/feed.xml", cat: "模型" },
        { name: "The Verge AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", cat: "新闻" },
        { name: "OpenAI 博客", url: "https://openai.com/blog/rss.xml", cat: "新闻" },
      ],
    },
  },
};

/** 配置结构：{ active, industries: { 名: { sources: [{name,url,cat}] } } } */
let config = loadConfig();
migrateCats();
let currentItems = [];    // 当前行业已加载的条目
let searchKeyword = "";   // 热点搜索词
let selectedCat = "全部"; // 当前子分类
let dirMode = false;      // 是否处于 AI 目录视图
let directoryData = null; // AI 目录数据缓存

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (c && c.industries && Object.keys(c.industries).length > 0) return c;
    }
  } catch (e) { console.warn("config parse failed", e); }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function saveConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/** 按源名称/URL 自动猜分类 */
function autoCat(name, url) {
  const t = (name + " " + url).toLowerCase();
  if (/agent/.test(t)) return "Agent";
  if (/模型|model|\bllm\b/.test(t)) return "模型";
  if (/工具|tool|助手|editor|copilot|studio|绘图|paint|diffusion/.test(t)) return "工具";
  if (/社区|forum|reddit|hacker.?news|v2ex|zhihu|贴吧/.test(t)) return "社区";
  return "新闻";
}

/** 旧配置的信息源没有 cat 字段，自动补上 */
function migrateCats() {
  let changed = false;
  for (const ind of Object.values(config.industries)) {
    for (const s of ind.sources) {
      if (!s.cat) { s.cat = autoCat(s.name, s.url); changed = true; }
    }
  }
  if (changed) saveConfig();
}

/** 面向新技术/行业资讯：为老用户自动补充内置的优质行业（不影响当前激活项） */
const BONUS_INDUSTRIES = {
  科技前沿: [
    { name: "Solidot", url: "https://www.solidot.org/index.rss", cat: "新闻" },
    { name: "Quanta Magazine", url: "https://www.quantamagazine.org/feed/", cat: "新闻" },
    { name: "MIT News", url: "https://news.mit.edu/rss/topic/artificial-intelligence2", cat: "新闻" },
    { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", cat: "新闻" },
    { name: "arXiv AI 论文", url: "http://export.arxiv.org/rss/cs.AI", cat: "新闻" },
  ],
  创业与行业: [
    { name: "TechCrunch", url: "https://techcrunch.com/feed/", cat: "新闻" },
    { name: "Product Hunt", url: "https://www.producthunt.com/feed", cat: "工具" },
    { name: "华尔街见闻", url: "https://dedicated.wallstreetcn.com/rss.xml", cat: "新闻" },
    { name: "少数派", url: "https://sspai.com/feed", cat: "工具" },
    { name: "V2EX", url: "https://www.v2ex.com/index.xml", cat: "社区" },
  ],
};

function migrateBonusIndustries() {
  let changed = false;
  for (const [name, sources] of Object.entries(BONUS_INDUSTRIES)) {
    if (!config.industries[name]) {
      config.industries[name] = { sources: sources.map((s) => ({ ...s })) };
      changed = true;
    }
  }
  if (changed) saveConfig();
}

/* ===== DOM ===== */
const tabsEl = document.getElementById("tabs");
const feedListEl = document.getElementById("feed-list");
const emptyHintEl = document.getElementById("empty-hint");
const sourceStatusEl = document.getElementById("source-status");
const updatedAtEl = document.getElementById("updated-at");
const hotTitleEl = document.getElementById("hot-title");
const industryListEl = document.getElementById("industry-list");
const searchInput = document.getElementById("searchInput");
const subnavEl = document.getElementById("subnav");
const hotGrid = document.getElementById("hot-grid");
const directoryView = document.getElementById("directory-view");
const dirSearch = document.getElementById("dirSearch");
const dirSections = document.getElementById("dir-sections");

const modalAdd = document.getElementById("modal-add");
const modalManage = document.getElementById("modal-manage");
const modalImport = document.getElementById("modal-import");

const $ = (id) => document.getElementById(id);

/* ===== 视图切换：热榜 / AI 目录 ===== */
function showHotView() {
  dirMode = false;
  directoryView.classList.add("hidden");
  hotGrid.classList.remove("hidden");
  renderTabs();
}

function showDirectoryView() {
  dirMode = true;
  directoryView.classList.remove("hidden");
  hotGrid.classList.add("hidden");
  renderTabs(); // 高亮 AI 目录导航
  loadDirectory();
}

/* ===== AI 目录 ===== */
async function loadDirectory() {
  if (!directoryData) {
    dirSections.innerHTML = `<div class="loading">⏳ 加载目录…</div>`;
    try {
      const resp = await fetch("/api/directory");
      directoryData = await resp.json();
    } catch (e) {
      dirSections.innerHTML = `<div class="loading">目录加载失败：${escapeHtml(String(e))}</div>`;
      return;
    }
  }
  renderDirectory();
}

function renderDirectory() {
  const kw = dirSearch.value.trim().toLowerCase();
  const sections = [
    ["🛠️ AI 工具", directoryData.tools],
    ["🧠 AI 模型", directoryData.models],
    ["🤖 AI Agent", directoryData.agents],
  ];
  let html = "";
  for (const [title, items] of sections) {
    const filtered = kw
      ? items.filter((it) => (it.name + it.desc + (it.tags || []).join(" ")).toLowerCase().includes(kw))
      : items;
    if (!filtered.length) continue;
    html += `<div class="dir-section-title">${title} <span class="muted">${filtered.length} 个</span></div><div class="dir-grid">`;
    for (const it of filtered) {
      html += `<a class="dir-card" href="${escapeAttr(it.url)}" target="_blank" rel="noopener">
        <div class="dir-name">${escapeHtml(it.name)}</div>
        <div class="dir-desc">${escapeHtml(it.desc)}</div>
        <div class="dir-meta">
          <span class="hot-badge fire">${escapeHtml(it.pricing)}</span>
          ${(it.tags || []).map((t) => `<span class="hot-badge">${escapeHtml(t)}</span>`).join("")}
        </div>
      </a>`;
    }
    html += `</div>`;
  }
  dirSections.innerHTML = html || `<div class="loading">没有匹配的条目。</div>`;
}

dirSearch.addEventListener("input", renderDirectory);

/* ===== 渲染顶部行业导航（ai-hot 风格：图标 + 文字） ===== */
function autoIcon(name) {
  const t = name.toLowerCase();
  const map = [
    [/\b(ai|aigc|llm|人工智能|大模型)/, "🤖"],
    [/3d|打印/, "🖨️"],
    [/游戏|game|电竞/, "🎮"],
    [/编程|code|开发|软件/, "💻"],
    [/财经|投资|股票|金融/, "💰"],
    [/汽车|车|ev/, "🚗"],
    [/摄影|相机|photo/, "📷"],
    [/科学|科研|space|天文|科技|前沿|论文/, "🔬"],
    [/创业|行业|商业|投资|财经/, "💼"],
    [/体育|足球|篮球|sport/, "⚽"],
    [/硬件|数码|手机|科技/, "📱"],
    [/新闻|news|资讯/, "📰"],
    [/电影|剧|影视/, "🎬"],
    [/音乐|music/, "🎵"],
    [/书|阅读|小说/, "📚"],
    [/美食|烹饪|烘焙/, "🍳"],
    [/旅行|旅游|travel/, "✈️"],
  ];
  for (const [re, icon] of map) if (re.test(t)) return icon;
  return "📌";
}

function renderTabs() {
  tabsEl.innerHTML = "";
  const names = Object.keys(config.industries);
  for (const name of names) {
    const a = document.createElement("a");
    a.innerHTML = `${autoIcon(name)} ${escapeHtml(name)}`;
    if (name === config.active && !dirMode) a.classList.add("active");
    a.addEventListener("click", () => {
      config.active = name;
      saveConfig();
      selectedCat = "全部";
      showHotView();
      renderIndustryList();
      renderFeed();
    });
    tabsEl.appendChild(a);
  }
  // AI 目录导航项（固定排在最后）
  const dirA = document.createElement("a");
  dirA.id = "nav-directory";
  dirA.innerHTML = "🧠 AI 目录";
  if (dirMode) dirA.classList.add("active");
  dirA.addEventListener("click", () => {
    dirMode ? showHotView() : showDirectoryView();
  });
  tabsEl.appendChild(dirA);
}

/* ===== 渲染侧栏行业列表 ===== */
function renderIndustryList() {
  const names = Object.keys(config.industries);
  industryListEl.innerHTML = names.length
    ? ""
    : `<div class="muted">还没有行业，点右上角「＋ 添加行业」</div>`;
  for (const name of names) {
    const div = document.createElement("div");
    div.className = "ind-item";
    div.innerHTML = `
      <span class="ind-name ${name === config.active ? "active" : ""}">${escapeHtml(name)}</span>
      <span class="ind-op" data-op="manage" title="行业设置">⚙</span>
      <span class="ind-op ind-del" data-op="delete" title="删除行业">✕</span>`;
    div.querySelector(".ind-name").addEventListener("click", () => {
      config.active = name;
      saveConfig();
      selectedCat = "全部";
      showHotView();
      renderIndustryList();
      renderFeed();
    });
    div.querySelector('[data-op="manage"]').addEventListener("click", () => openManage(name));
    div.querySelector('[data-op="delete"]').addEventListener("click", () => deleteIndustry(name));
    industryListEl.appendChild(div);
  }
}

function deleteIndustry(name) {
  if (!confirm(`确定删除行业「${name}」？`)) return;
  delete config.industries[name];
  if (config.active === name) config.active = Object.keys(config.industries)[0] || null;
  saveConfig();
  renderTabs();
  renderIndustryList();
  renderFeed();
}

/* ===== 子分类导航 ===== */
function renderSubnav() {
  const ind = config.industries[config.active];
  if (!ind || !ind.sources.length) { subnavEl.innerHTML = ""; return; }
  const cats = [];
  for (const s of ind.sources) {
    if (s.cat && !cats.includes(s.cat)) cats.push(s.cat);
  }
  cats.sort((a, b) => {
    const ia = CATEGORIES.indexOf(a), ib = CATEGORIES.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const all = ["全部", ...cats];
  if (!all.includes(selectedCat)) selectedCat = "全部";
  subnavEl.innerHTML = "";
  for (const c of all) {
    const a = document.createElement("a");
    a.textContent = c;
    if (c === selectedCat) a.classList.add("active");
    a.addEventListener("click", () => {
      selectedCat = c;
      renderSubnav();
      applyFilter();
    });
    subnavEl.appendChild(a);
  }
}

/** feed_url → 分类 */
function catOf(feedUrl) {
  const ind = config.industries[config.active];
  if (!ind) return "新闻";
  const s = ind.sources.find((x) => x.url === feedUrl);
  return s ? s.cat || "新闻" : "新闻";
}

/* ===== 渲染热点列表 ===== */
function renderItems(items) {
  feedListEl.innerHTML = "";
  if (!items.length) {
    feedListEl.innerHTML = `<div class="loading">没有匹配的热点。</div>`;
    return;
  }
  items.slice(0, 100).forEach((item, i) => {
    const a = document.createElement("a");
    a.className = "hot-item";
    a.href = item.link;
    a.target = "_blank";
    a.rel = "noopener";
    const date = item.published
      ? new Date(item.published * 1000).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })
      : "";
    // 已翻译则显示目标语言（悬停可见原文）
    const showZh = currentLang !== "原文" && item._zh && item._lang === currentLang;
    const title = showZh && item._zh.title ? item._zh.title : item.title;
    const hasSummaryTr = item._zh && item._lang === currentLang && item._zh.summary;
    const summary = hasSummaryTr ? item._zh.summary : item.summary;
    a.title = item.title;
    a.innerHTML = `
      <div class="hot-rank ${i < 3 ? "top3" : "normal"}">${i + 1}</div>
      <div class="hot-content">
        <div class="hot-title">${escapeHtml(title)}</div>
        ${summary ? `<div class="hot-meta">⚡ ${escapeHtml(summary)}</div>` : ""}
        <div class="hot-meta">
          <span class="hot-badge">${escapeHtml(item.source)}</span>
          ${date ? `<span style="color:var(--text3);margin-left:4px">${date}</span>` : ""}
          ${showZh ? `<span class="hot-badge ok">译·${escapeHtml(currentLang)}</span>` : ""}
          ${hasSummaryTr
            ? `<span class="hot-badge ok">摘要已译</span>`
            : `<span class="hot-badge tr" title="翻译成${escapeHtml(currentLang)}">译</span>`}
        </div>
      </div>`;
    const trBtn = a.querySelector(".tr");
    if (trBtn) trBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      translateItems([item]);
    });
    feedListEl.appendChild(a);
  });
}

/* ===== AI 翻译 ===== */
const trStatusEl = document.getElementById("tr-status");
let translating = false;

/* 语言设置：存浏览器，标题自动翻译到该语言 */
const LANG_KEY = "hotboard_lang";
function loadLang() { return localStorage.getItem(LANG_KEY) || "中文"; }
function saveLang(l) { localStorage.setItem(LANG_KEY, l); }
let currentLang = loadLang();

const selLang = document.getElementById("sel-lang");
selLang.value = currentLang;
selLang.addEventListener("change", () => {
  currentLang = selLang.value;
  saveLang(currentLang);
  applyFilter();
  if (currentLang !== "原文") ensureTitlesTranslated();
});

async function callTranslate(targets, withSummary) {
  const s = loadAISettings();
  if (!s.api_key) return null;
  const resp = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: targets.map((it) => ({ title: it.title, summary: withSummary ? it.summary : "" })),
      base_url: s.base_url, api_key: s.api_key, model: s.model, lang: currentLang,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.detail || "翻译失败");
  return data.translations;
}

/** 语言非「原文」时：自动把当前页标题+摘要批量翻译为目标语言 */
async function ensureTitlesTranslated() {
  if (currentLang === "原文") return;
  const need = currentItems.filter(
    (it) => it._lang !== currentLang || !it._zh || !it._zh.title || (it.summary && !it._zh.summary)
  );
  if (!need.length) return;
  const s = loadAISettings();
  if (!s.api_key) {
    trStatusEl.textContent = "⚠️ 点「＋ 添加行业」里的 ⚙ 配置 API Key 后，将自动全文翻译";
    return;
  }
  translating = true;
  try {
    for (let i = 0; i < need.length; i += 25) {
      if (currentLang === "原文") break;
      const batch = need.slice(i, i + 25);
      const trs = await callTranslate(batch, true);
      batch.forEach((it, j) => {
        it._zh = { title: trs[j].title || it.title, summary: trs[j].summary };
        it._lang = currentLang;
      });
      trStatusEl.textContent = `⏳ 自动翻译中 ${Math.min(i + 25, need.length)}/${need.length}…`;
      applyFilter();
    }
    trStatusEl.textContent = `✅ 本页已全部翻译为${currentLang}`;
  } catch (e) {
    trStatusEl.textContent = `❌ ${e.message}（可点每条热点的「译」重试）`;
  } finally {
    translating = false;
  }
}

/** 「译」按钮：翻译标题 + 摘要 */
async function translateItems(items) {
  if (translating) { trStatusEl.textContent = "⏳ 正在翻译，请稍候…"; return; }
  const targets = items.filter((it) => !it._zh || it._lang !== currentLang || !it._zh.summary).slice(0, 25);
  if (!targets.length) { trStatusEl.textContent = "本页已全部翻译 ✓"; return; }
  if (!loadAISettings().api_key) {
    trStatusEl.textContent = "⚠️ 请先在「＋ 添加行业」弹窗里点 ⚙ 配置 API Key";
    return;
  }
  translating = true;
  trStatusEl.textContent = `⏳ AI 翻译摘要中（${targets.length} 条）…`;
  try {
    const trs = await callTranslate(targets, true);
    targets.forEach((it, i) => {
      it._zh = { title: trs[i].title || it.title, summary: trs[i].summary };
      it._lang = currentLang;
    });
    trStatusEl.textContent = `✅ 已翻译 ${targets.length} 条（含摘要）`;
    applyFilter();
  } catch (e) {
    trStatusEl.textContent = `❌ ${e.message}`;
  } finally {
    translating = false;
  }
}

document.getElementById("btn-translate-all").addEventListener("click", () => {
  let items = currentItems;
  if (selectedCat !== "全部") items = items.filter((it) => catOf(it.feed_url) === selectedCat);
  if (searchKeyword.trim()) {
    const kw = searchKeyword.trim().toLowerCase();
    items = items.filter((it) => (it.title + " " + it.summary + " " + it.source).toLowerCase().includes(kw));
  }
  translateItems(items);
});

async function renderFeed(force = false) {
  sourceStatusEl.innerHTML = "";
  feedListEl.innerHTML = "";
  currentItems = [];
  const name = config.active;
  if (!name || !config.industries[name]) {
    emptyHintEl.style.display = "block";
    hotTitleEl.textContent = "今日热点";
    updatedAtEl.textContent = "—";
    subnavEl.innerHTML = "";
    return;
  }
  emptyHintEl.style.display = "none";
  hotTitleEl.textContent = `${name} · 今日热点`;
  renderSubnav();

  const sources = config.industries[name].sources;
  if (!sources.length) {
    feedListEl.innerHTML = `<div class="loading">该行业还没有信息源，到侧栏点 ⚙ 添加。</div>`;
    return;
  }

  feedListEl.innerHTML = `<div class="loading">⏳ 正在加载「${escapeHtml(name)}」热点…</div>`;

  const urls = sources.map((s) => s.url).join(",");
  try {
    const resp = await fetch(`/api/feed?urls=${encodeURIComponent(urls)}${force ? "&t=" + Date.now() : ""}`);
    if (!resp.ok) throw new Error("API " + resp.status);
    const data = await resp.json();

    sourceStatusEl.innerHTML = data.sources
      .map((s) => {
        const short = s.url.startsWith("search://")
          ? "🔑" + s.url.slice(9)
          : s.url.replace(/^https?:\/\//, "").split("/")[0];
        return s.ok
          ? `<span class="hot-badge ok">✓ ${escapeHtml(short)} ${s.count}</span>`
          : `<span class="hot-badge fail">✗ ${escapeHtml(short)} 失败</span>`;
      })
      .join("");

    const time = new Date(data.updated * 1000);
    updatedAtEl.textContent = `🕐 更新于 ${time.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;

    currentItems = data.items;
    applyFilter();
    // 语言设置非「原文」时，自动翻译标题
    if (currentLang !== "原文") ensureTitlesTranslated();
  } catch (err) {
    feedListEl.innerHTML = `<div class="loading">加载失败：${escapeHtml(String(err))}（确认后端已启动）</div>`;
  }
}

/* ===== 搜索过滤（关键词 + 子分类） ===== */
function applyFilter() {
  const kw = searchKeyword.trim().toLowerCase();
  let items = currentItems;
  if (selectedCat !== "全部") {
    items = items.filter((it) => catOf(it.feed_url) === selectedCat);
  }
  if (kw) {
    items = items.filter((it) =>
      (it.title + " " + it.summary + " " + it.source).toLowerCase().includes(kw));
  }
  renderItems(items);
}

searchInput.addEventListener("input", () => {
  searchKeyword = searchInput.value;
  applyFilter();
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    (dirMode ? dirSearch : searchInput).focus();
  }
});

/* ===== 添加行业弹窗 ===== */
let pendingSources = [];

/* --- AI 推荐设置（存浏览器，只发给自己的后端） --- */
const AI_KEY = "hotboard_ai";

function loadAISettings() {
  try {
    return Object.assign(
      { base_url: "https://api.deepseek.com/v1", api_key: "", model: "deepseek-chat" },
      JSON.parse(localStorage.getItem(AI_KEY) || "{}")
    );
  } catch { return { base_url: "https://api.deepseek.com/v1", api_key: "", model: "deepseek-chat" }; }
}

function saveAISettings(s) {
  localStorage.setItem(AI_KEY, JSON.stringify(s));
}

$("btn-ai-settings").addEventListener("click", () => {
  const s = loadAISettings();
  $("input-ai-base").value = s.base_url;
  $("input-ai-key").value = s.api_key;
  $("input-ai-model").value = s.model;
  $("ai-settings").classList.toggle("hidden");
});

$("btn-ai-save").addEventListener("click", () => {
  saveAISettings({
    base_url: $("input-ai-base").value.trim() || "https://api.deepseek.com/v1",
    api_key: $("input-ai-key").value.trim(),
    model: $("input-ai-model").value.trim() || "deepseek-chat",
  });
  $("ai-settings").classList.add("hidden");
  $("ai-status").textContent = "✅ AI 接口设置已保存";
});

$("btn-ai-suggest").addEventListener("click", async () => {
  const kw = $("input-ai-keyword").value.trim()
    || $("input-keyword").value.trim()
    || $("input-industry-name").value.trim();
  if (!kw) { $("ai-status").textContent = "请先输入一个关键词（如：3D打印）"; return; }

  const s = loadAISettings();
  if (!s.api_key) {
    $("ai-status").textContent = "⚠️ 还没配置 API Key，点右侧 ⚙ 填写（支持 DeepSeek / 硅基流动 / OpenAI 等）";
    $("ai-settings").classList.remove("hidden");
    return;
  }

  $("btn-ai-suggest").disabled = true;
  $("ai-status").textContent = `⏳ AI 正在为你推荐「${kw}」的信息源…（约 10-30 秒）`;
  try {
    const resp = await fetch("/api/ai-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: kw, base_url: s.base_url, api_key: s.api_key, model: s.model }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || "请求失败");

    // 自动填行业名
    if (!$("input-industry-name").value.trim()) {
      $("input-industry-name").value = data.industry_name;
    }
    // 推荐源加入已选列表（去重）
    let added = 0;
    for (const src of data.sources) {
      if (pendingSources.some((x) => x.url === src.url)) continue;
      pendingSources.push({ name: src.name, url: src.url, cat: src.cat });
      added++;
    }
    renderPending();
    const dropped = data.dropped ? `（${data.dropped} 个网站没发现 RSS，已跳过）` : "";
    $("ai-status").textContent = `✅ 从 AI 推荐的网站中发现 ${added} 个可用订阅${dropped}，确认后点「✓ 创建行业」`;
  } catch (e) {
    $("ai-status").textContent = `❌ ${e.message}（也可用手动方式添加）`;
  } finally {
    $("btn-ai-suggest").disabled = false;
  }
});

function openAdd() {
  $("input-industry-name").value = "";
  $("input-keyword").value = "";
  $("input-site").value = "";
  $("input-manual-name").value = "";
  $("input-manual-url").value = "";
  $("input-ai-keyword").value = "";
  $("input-kw-track").value = "";
  $("ai-status").textContent = "";
  $("suggest-list").innerHTML = "";
  pendingSources = [];
  renderPending();
  modalAdd.classList.remove("hidden");
  $("input-ai-keyword").focus();
}

function renderPending() {
  $("selected-count").textContent = pendingSources.length;
  $("selected-list").innerHTML = pendingSources
    .map(
      (s, i) => `<div class="src-item">
        <span class="src-name">${escapeHtml(s.name)}</span>
        <span class="hot-badge">${escapeHtml(s.cat)}</span>
        <span class="grow src-url">${escapeHtml(s.url)}</span>
        <button class="src-remove" data-i="${i}">✕ 移除</button>
      </div>`
    )
    .join("");
  $("selected-list").querySelectorAll(".src-remove").forEach((btn) =>
    btn.addEventListener("click", () => {
      pendingSources.splice(Number(btn.dataset.i), 1);
      renderPending();
    })
  );
}

function addPending(name, url) {
  if (pendingSources.some((s) => s.url === url)) return;
  pendingSources.push({ name: name || url, url, cat: autoCat(name || "", url) });
  renderPending();
}

$("btn-suggest").addEventListener("click", async () => {
  const kw = $("input-keyword").value.trim();
  if (!kw) return;
  $("suggest-list").innerHTML = `<div class="loading">⏳ 搜索推荐源…</div>`;
  try {
    const resp = await fetch(`/api/suggest?keyword=${encodeURIComponent(kw)}`);
    const data = await resp.json();
    const box = $("suggest-list");
    if (!data.sources.length) {
      box.innerHTML = `<div class="loading">目录里没有「${escapeHtml(kw)}」的推荐源，可以手动添加或探测网站。</div>`;
      return;
    }
    box.innerHTML = "";
    for (const s of data.sources) {
      const div = document.createElement("div");
      div.className = "src-item";
      div.innerHTML = `
        <span class="src-name">${escapeHtml(s.name)}</span>
        <span class="src-note">${escapeHtml(s.industry)} · ${escapeHtml(s.note || "")}</span>
        <span class="grow src-url">${escapeHtml(s.url)}</span>
        <button class="src-add">＋ 添加</button>`;
      div.querySelector(".src-add").addEventListener("click", () => addPending(s.name, s.url));
      box.appendChild(div);
    }
  } catch (e) {
    $("suggest-list").innerHTML = `<div class="loading">推荐失败：${escapeHtml(String(e))}</div>`;
  }
});

$("btn-detect").addEventListener("click", async () => {
  const site = $("input-site").value.trim();
  if (!site) return;
  $("suggest-list").innerHTML = `<div class="loading">⏳ 正在探测 ${escapeHtml(site)} 的 RSS…</div>`;
  try {
    const resp = await fetch("/api/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: site }),
    });
    const data = await resp.json();
    const box = $("suggest-list");
    if (!data.rss.length) {
      box.innerHTML = `<div class="loading">没找到 RSS，可以试试手动添加。</div>`;
      return;
    }
    box.innerHTML = "";
    for (const url of data.rss) {
      const div = document.createElement("div");
      div.className = "src-item";
      div.innerHTML = `
        <span class="src-name">🔌 发现的 RSS</span>
        <span class="grow src-url">${escapeHtml(url)}</span>
        <button class="src-add">＋ 添加</button>`;
      div.querySelector(".src-add").addEventListener("click", () => addPending(site.replace(/^https?:\/\//, ""), url));
      box.appendChild(div);
    }
  } catch (e) {
    $("suggest-list").innerHTML = `<div class="loading">探测失败：${escapeHtml(String(e))}</div>`;
  }
});

$("btn-add-manual").addEventListener("click", () => {
  const url = $("input-manual-url").value.trim();
  if (!url) return;
  addPending($("input-manual-name").value.trim(), url);
  $("input-manual-name").value = "";
  $("input-manual-url").value = "";
});

$("btn-confirm-add").addEventListener("click", () => {
  // 关键词跟踪：每个关键词生成一个聚合多搜索引擎的订阅源
  const kws = $("input-kw-track").value.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
  for (const kw of kws) {
    const url = `search://${kw}`;
    if (!pendingSources.some((s) => s.url === url)) {
      pendingSources.push({ name: `关键词·${kw}`, url, cat: "新闻" });
    }
  }
  renderPending();
  let name = $("input-industry-name").value.trim();
  if (!name && kws.length) name = kws[0]; // 没填行业名时用第一个关键词当名字
  if (!name) { alert("请填写行业名称"); return; }
  if (!pendingSources.length) { alert("请至少添加一个信息源（推荐 / 探测 / 关键词 / 手动均可）"); return; }
  config.industries[name] = { sources: pendingSources.slice() };
  config.active = name;
  saveConfig();
  modalAdd.classList.add("hidden");
  selectedCat = "全部";
  showHotView();
  renderIndustryList();
  renderFeed();
});

$("btn-cancel-add").addEventListener("click", () => modalAdd.classList.add("hidden"));
$("btn-add-industry").addEventListener("click", openAdd);

/* ===== 行业管理弹窗（含分类修改） ===== */
let manageName = null;

function openManage(name) {
  manageName = name;
  $("manage-title").textContent = `「${name}」行业设置`;
  $("input-rename").value = name;
  renderManageSources();
  modalManage.classList.remove("hidden");
}

function catSelectHtml(current) {
  const opts = CATEGORIES.includes(current)
    ? CATEGORIES
    : [...CATEGORIES, current];
  return `<select class="src-cat" data-cat>
    ${opts.map((c) => `<option value="${escapeAttr(c)}" ${c === current ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
    <option value="__custom">自定义…</option>
  </select>`;
}

function renderManageSources() {
  const srcs = config.industries[manageName]?.sources || [];
  $("manage-sources").innerHTML = srcs.length
    ? srcs
        .map(
          (s, i) => `<div class="src-item">
        <span class="src-name">${escapeHtml(s.name)}</span>
        ${catSelectHtml(s.cat || "新闻").replace("data-cat", `data-cat="${i}"`)}
        <span class="grow src-url">${escapeHtml(s.url)}</span>
        <button class="src-remove" data-i="${i}">✕ 删除</button>
      </div>`
        )
        .join("")
    : `<div class="loading">没有信息源，添加行业时可勾选推荐源。</div>`;

  // 分类下拉框
  $("manage-sources").querySelectorAll("select[data-cat]").forEach((sel) =>
    sel.addEventListener("change", () => {
      const i = Number(sel.dataset.cat);
      if (sel.value === "__custom") {
        const custom = prompt("输入自定义分类名称：", config.industries[manageName].sources[i].cat || "");
        if (custom && custom.trim()) {
          config.industries[manageName].sources[i].cat = custom.trim();
        }
      } else {
        config.industries[manageName].sources[i].cat = sel.value;
      }
      saveConfig();
      renderManageSources();
      renderSubnav();
      applyFilter();
    })
  );

  // 删除源
  $("manage-sources").querySelectorAll(".src-remove").forEach((btn) =>
    btn.addEventListener("click", () => {
      config.industries[manageName].sources.splice(Number(btn.dataset.i), 1);
      saveConfig();
      renderManageSources();
      renderSubnav();
      renderFeed();
    })
  );
}

$("btn-rename").addEventListener("click", () => {
  const newName = $("input-rename").value.trim();
  if (!newName || newName === manageName || !config.industries[manageName]) return;
  if (config.industries[newName]) { alert("已有同名行业"); return; }
  config.industries[newName] = config.industries[manageName];
  delete config.industries[manageName];
  if (config.active === manageName) config.active = newName;
  manageName = newName;
  $("manage-title").textContent = `「${newName}」行业设置`;
  saveConfig();
  renderTabs();
  renderIndustryList();
});

$("btn-delete-industry").addEventListener("click", () => {
  modalManage.classList.add("hidden");
  deleteIndustry(manageName);
});

$("btn-close-manage").addEventListener("click", () => {
  modalManage.classList.add("hidden");
  renderTabs();
  renderIndustryList();
  renderFeed();
});

/* ===== 导出 / 导入 ===== */
$("btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "hotboard-config.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("btn-import").addEventListener("click", () => {
  $("input-import").value = "";
  modalImport.classList.remove("hidden");
});
$("btn-cancel-import").addEventListener("click", () => modalImport.classList.add("hidden"));
$("btn-confirm-import").addEventListener("click", () => {
  try {
    const c = JSON.parse($("input-import").value);
    if (!c.industries) throw new Error("格式不正确");
    config = c;
    migrateCats();
    if (config.active && !config.industries[config.active]) config.active = Object.keys(config.industries)[0] || null;
    saveConfig();
    modalImport.classList.add("hidden");
    selectedCat = "全部";
    showHotView();
    renderIndustryList();
    renderFeed();
  } catch (e) {
    alert("导入失败：" + e.message);
  }
});

/* ===== 刷新 ===== */
$("btn-refresh").addEventListener("click", () => {
  if (dirMode) { renderDirectory(); return; }
  renderFeed(true);
});

/* ===== 工具 ===== */
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

/* ===== 启动 ===== */
migrateBonusIndustries();
renderTabs();
renderIndustryList();
renderFeed();
// 支持 http://localhost:8000/#directory 直接打开 AI 目录
if (location.hash === "#directory") showDirectoryView();
