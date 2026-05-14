(function initMoonwhiteApp(window, document) {
  "use strict";

  const characters = window.MoonwhiteCharacters || [];
  const pools = window.MoonwhitePools || { activePoolId: "", pools: [] };
  const engine = window.MoonwhiteGachaEngine;
  const root = document.getElementById("app");

  if (!engine || !root) return;

  const STORAGE_KEYS = {
    gachaState: "moonwhiteEchoes.gachaState",
    history: "moonwhiteEchoes.history",
    collection: "moonwhiteEchoes.collection"
  };

  const appState = {
    view: "pool",
    activeBatch: [],
    revealedIds: [],
    lastRevealedInstanceId: "",
    selectedCharacterId: "",
    galleryFilter: "all",
    isAnimating: false,
    gachaState: engine.createInitialGachaState(),
    history: [],
    collection: {}
  };
  let summonTimerId = 0;
  let activePullToken = 0;
  let lastRenderedView = "";
  const preloadedImages = new Set();

  function safeParse(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function readStorage(key, fallback) {
    try {
      return safeParse(window.localStorage.getItem(key), fallback);
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Storage can fail in private browsing or restricted embeds; the app keeps running in memory.
    }
  }

  function isArray(value) {
    return Array.isArray(value);
  }

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  function normalizeGachaState(value) {
    const defaults = engine.createInitialGachaState();
    if (!isPlainObject(value)) return defaults;

    return Object.keys(defaults).reduce((state, key) => {
      const defaultValue = defaults[key];
      const nextValue = value[key];
      if (typeof defaultValue === "number" && Number.isFinite(nextValue)) {
        state[key] = nextValue;
      }
      if (typeof defaultValue === "boolean" && typeof nextValue === "boolean") {
        state[key] = nextValue;
      }
      return state;
    }, { ...defaults });
  }

  function loadState() {
    const storedHistory = readStorage(STORAGE_KEYS.history, []);
    const storedCollection = readStorage(STORAGE_KEYS.collection, {});

    appState.gachaState = normalizeGachaState(readStorage(STORAGE_KEYS.gachaState, {}));
    appState.history = isArray(storedHistory) ? storedHistory : [];
    appState.collection = isPlainObject(storedCollection) ? storedCollection : {};
  }

  function saveState() {
    writeStorage(STORAGE_KEYS.gachaState, appState.gachaState);
    writeStorage(STORAGE_KEYS.history, appState.history);
    writeStorage(STORAGE_KEYS.collection, appState.collection);
  }

  function mergeCollection(results) {
    results.forEach((result) => {
      if (!result || !result.id) return;
      const timestamp = new Date().toISOString();
      const stored = appState.collection[result.id];
      const existing = isPlainObject(stored)
        ? stored
        : {
            id: result.id,
            name: result.name,
            rarity: result.rarity,
            rarityLabel: result.rarityLabel,
            count: 0,
            firstObtainedAt: "",
            lastObtainedAt: ""
          };
      const previousCount = Number.isFinite(existing.count) ? existing.count : 0;

      result.isNew = previousCount === 0;
      result.duplicateCount = previousCount;
      appState.collection[result.id] = {
        ...existing,
        id: result.id,
        name: result.name,
        rarity: result.rarity,
        rarityLabel: result.rarityLabel,
        count: previousCount + 1,
        firstObtainedAt: existing.firstObtainedAt || existing.firstSeenAt || timestamp,
        lastObtainedAt: timestamp
      };
    });
  }

  function resetLocalData() {
    if (!window.confirm("确定清空全部本地数据吗？这会重置抽卡状态、图鉴和记录。")) return;
    clearSummonTimer();
    activePullToken += 1;
    appState.view = "pool";
    appState.activeBatch = [];
    appState.revealedIds = [];
    appState.lastRevealedInstanceId = "";
    appState.selectedCharacterId = "";
    appState.galleryFilter = "all";
    appState.isAnimating = false;
    appState.gachaState = engine.createInitialGachaState();
    appState.history = [];
    appState.collection = {};
    saveState();
    render();
  }

  function setView(view) {
    if (view !== "summon") {
      clearSummonTimer();
      activePullToken += 1;
    }
    appState.view = view;
    if (view !== "summon") {
      appState.isAnimating = false;
    }
    render();
  }

  function getActivePool() {
    return engine.getActivePool(pools);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function button(action, label, attributes) {
    return `<button type="button" data-action="${action}" ${attributes || ""}>${label}</button>`;
  }

  function chromeButton(action, label, currentView, targetView) {
    const active = currentView === targetView ? " is-active" : "";
    return button(action, label, `class="chrome-nav-button${active}"`);
  }

  function renderGameChrome(currentView) {
    return `
      <header class="game-chrome ritual-topbar" aria-label="月白回响导航">
        <div class="brand-lockup">
          <span class="brand-emblem" aria-hidden="true"></span>
          <span>月白回响</span>
          <strong>星辉神殿</strong>
        </div>
        <nav class="chrome-nav quick-orb-nav" aria-label="主要页面">
          ${chromeButton("back-pool", '<span class="game-icon icon-wish" aria-hidden="true"></span><span>祈愿</span>', currentView, "pool")}
          ${chromeButton("open-gallery", '<span class="game-icon icon-archive" aria-hidden="true"></span><span>图鉴</span>', currentView, "gallery")}
          ${chromeButton("open-history", '<span class="game-icon icon-scroll" aria-hidden="true"></span><span>记录</span>', currentView, "history")}
        </nav>
        <div class="chrome-stats" aria-label="祈愿状态">
          <span class="resource-metre"><b>月辉</b> ${appState.gachaState.moonPity}/80</span>
          <span class="resource-metre"><b>星辉</b> ${appState.gachaState.starPity}/10</span>
        </div>
      </header>
    `;
  }

  function rarityTone(rarity) {
    if (rarity === "moon") return "月辉";
    if (rarity === "star") return "星辉";
    return "微光";
  }

  function getCharacter(id) {
    return characters.find((character) => character.id === id);
  }

  function cardImage(character) {
    return character && character.image ? character.image : "";
  }

  function imageSource(character, mode) {
    if (!character) return "";
    if (mode === "full" || mode === "hero") return character.image || character.thumbnail || "";
    return character.thumbnail || character.image || "";
  }

  function fallbackImageSource(character, mode) {
    if (!character) return "";
    const source = imageSource(character, mode);
    if (character.image && character.image !== source) return character.image;
    return "";
  }

  function preloadImage(src) {
    if (!src || !window.Image) return;
    if (preloadedImages.has(src)) return;
    preloadedImages.add(src);
    const image = new window.Image();
    image.decoding = "async";
    image.src = src;
  }

  function forceScrollToTop() {
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    if (typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }

  function scheduleScrollToTop() {
    forceScrollToTop();
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(forceScrollToTop);
    }
    if (typeof window.requestAnimationFrame === "function" && typeof window.setTimeout === "function") {
      window.setTimeout(forceScrollToTop, 80);
    }
  }

  function renderCharacterImage(character, options) {
    const settings = options || {};
    const image = imageSource(character, settings.mode || "card");
    const fallbackImage = fallbackImageSource(character, settings.mode || "card");
    const missingClass = image ? "" : " is-missing";
    const loadingAttribute = settings.eager ? 'loading="eager"' : 'loading="lazy"';
    const alt = character && character.name ? character.name : "角色立绘";
    const tag = settings.tag || "div";
    const ariaLabel = image ? "" : ' aria-label="角色立绘暂未开放"';
    const fallbackAttribute = fallbackImage ? ` data-fallback-src="${escapeHtml(fallbackImage)}"` : "";
    return `
      <${tag} class="${settings.className || "card-art"}${missingClass}"${ariaLabel}>
        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(alt)}" ${loadingAttribute} decoding="async"${fallbackAttribute} onerror="window.MoonwhiteApp.handleCardImageError(this)">` : ""}
        <span class="card-art-fallback" aria-hidden="true">月白回响</span>
      </${tag}>
    `;
  }

  function clearSummonTimer() {
    if (!summonTimerId) return;
    window.clearTimeout(summonTimerId);
    summonTimerId = 0;
  }

  function handleCardImageError(image) {
    if (!image) return;
    const fallbackSrc = image.dataset ? image.dataset.fallbackSrc : "";
    if (fallbackSrc && image.src !== fallbackSrc) {
      image.src = fallbackSrc;
      delete image.dataset.fallbackSrc;
      return;
    }
    image.hidden = true;
    image.removeAttribute("src");
    const art = image.closest ? image.closest(".card-art") : null;
    if (art) {
      art.classList.add("is-missing");
      art.setAttribute("aria-label", "角色立绘暂未开放");
    }
  }

  function annotateResults(results) {
    return results.map((result, index) => ({
      ...result,
      instanceId: `${result.pullNumber}-${index}-${result.id}`
    }));
  }

  function appendHistory(results) {
    const now = new Date().toISOString();
    const entries = results.map((result) => engine.summarizeHistoryEntry(result, appState.gachaState, now));
    appState.history = [...entries, ...appState.history].slice(0, 300);
  }

  function formatLocalTime(timestamp) {
    if (!timestamp) return "未知时间";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "未知时间";
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getOwnedCount(characterId) {
    const entry = appState.collection[characterId];
    return entry && Number.isFinite(entry.count) ? entry.count : 0;
  }

  function isOwned(characterId) {
    return getOwnedCount(characterId) > 0;
  }

  function setGalleryFilter(filter) {
    const validFilters = ["all", "moon", "star", "glimmer", "owned", "missing"];
    appState.galleryFilter = validFilters.includes(filter) ? filter : "all";
    render();
  }

  function highestRarity(results) {
    if (results.some((result) => result.rarity === "moon")) return "moon";
    if (results.some((result) => result.rarity === "star")) return "star";
    return "glimmer";
  }

  function getBestResult(results) {
    const rank = { moon: 3, star: 2, glimmer: 1 };
    return [...results].sort((a, b) => (rank[b.rarity] || 0) - (rank[a.rarity] || 0))[0];
  }

  function rarityForecastLabel(rarity) {
    if (rarity === "moon") return "月辉降临";
    if (rarity === "star") return "星辉回应";
    return "微光浮现";
  }

  function preloadBatchImages(results) {
    results.forEach((result) => preloadImage(imageSource(result, result.rarity === "moon" ? "hero" : "card")));
  }

  function enterResults() {
    clearSummonTimer();
    appState.revealedIds = appState.activeBatch.map((result) => result.instanceId);
    appState.lastRevealedInstanceId = "";
    appState.isAnimating = false;
    appState.view = "results";
    saveState();
    render();
  }

  function startPull(count) {
    clearSummonTimer();
    activePullToken += 1;
    const pullToken = activePullToken;
    const pool = getActivePool();
    const draw = engine.drawBatch({
      count,
      state: appState.gachaState,
      pool,
      characters,
      rng: Math.random
    });

    appState.gachaState = draw.nextState;
    appState.activeBatch = annotateResults(draw.results);
    preloadBatchImages(appState.activeBatch);
    appState.revealedIds = [];
    appState.lastRevealedInstanceId = "";
    mergeCollection(appState.activeBatch);
    appendHistory(appState.activeBatch);
    saveState();
    appState.view = "summon";
    appState.isAnimating = true;
    render();
    summonTimerId = window.setTimeout(() => {
      if (pullToken === activePullToken && appState.view === "summon" && appState.isAnimating) {
        summonTimerId = 0;
        enterResults();
      }
    }, 1650);
  }

  function revealAll() {
    clearSummonTimer();
    activePullToken += 1;
    appState.revealedIds = appState.activeBatch.map((result) => result.instanceId);
    appState.lastRevealedInstanceId = "";
    appState.isAnimating = false;
    appState.view = "results";
    saveState();
    render();
  }

  function hasMoonResult() {
    return appState.activeBatch.some((result) => result.rarity === "moon");
  }

  function renderArchiveList(character) {
    const archive = Array.isArray(character.archive) ? character.archive : [];
    const items = archive.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("");
    return `<ul class="archive-list">${items || "<li>暂无档案记录</li>"}</ul>`;
  }

  function buildHistoryGroups() {
    const groups = new Map();
    appState.history.forEach((entry) => {
      if (!entry) return;
      const character = getCharacter(entry.id) || characters.find((item) => item.name === entry.name) || {};
      const key = entry.id || character.id || entry.name || "unknown";
      const existing = groups.get(key) || {
        id: entry.id || character.id || "",
        name: entry.name || character.name || "未知回响",
        rarity: entry.rarity || character.rarity || "glimmer",
        rarityLabel: entry.rarityLabel || character.rarityLabel || "",
        title: character.title || "",
        faction: character.faction || "",
        count: 0,
        latestPullNumber: entry.pullNumber || "",
        latestTimestamp: entry.timestamp || "",
        firstTimestamp: entry.timestamp || "",
        isRateUp: Boolean(entry.isRateUp),
        character
      };
      existing.count += 1;
      existing.isRateUp = existing.isRateUp || Boolean(entry.isRateUp);
      if (!existing.firstTimestamp || (entry.timestamp && entry.timestamp < existing.firstTimestamp)) {
        existing.firstTimestamp = entry.timestamp;
      }
      if (!existing.latestTimestamp || (entry.timestamp && entry.timestamp > existing.latestTimestamp)) {
        existing.latestTimestamp = entry.timestamp;
        existing.latestPullNumber = entry.pullNumber || existing.latestPullNumber;
      }
      groups.set(key, existing);
    });

    return [...groups.values()].sort((a, b) => {
      const aTime = new Date(a.latestTimestamp || 0).getTime();
      const bTime = new Date(b.latestTimestamp || 0).getTime();
      return bTime - aTime;
    });
  }

  function renderCharacterCard(character, options) {
    const settings = options || {};
    const rarity = character.rarity || "glimmer";
    const badge = character.isNew ? "初遇" : character.duplicateCount > 0 ? `共鸣 ${character.duplicateCount + 1}` : "";

    return `
      <article class="character-card rarity-${escapeHtml(rarity)} ${settings.className || ""}">
        ${renderCharacterImage(character, { mode: settings.imageMode || "card", eager: settings.eager })}
        <div class="card-copy">
          <p class="rarity-label">${escapeHtml(character.rarityLabel || "")}</p>
          <h3>${escapeHtml(character.name || "未知回响")}</h3>
          <p>${escapeHtml(character.title || "")}</p>
          ${badge ? `<span class="card-badge">${escapeHtml(badge)}</span>` : ""}
        </div>
      </article>
    `;
  }

  function renderPool(pool) {
    const upCharacter = getCharacter(pool.rateUpCharacterId) || getCharacter("lunara") || characters[0] || {};
    const guaranteeText = appState.gachaState.guaranteedRateUp ? "下次月辉必定 UP" : "月辉 50% 限定 UP";
    preloadImage("./assets/ui/star-temple-bg.png");
    preloadImage("./assets/ui/summon-gate-bg.png");
    preloadImage(imageSource(upCharacter, "hero"));

    return `
      <main class="view pool-view game-view">
        ${renderGameChrome("pool")}
        <section class="pool-hero star-temple-home game-stage ritual-hub">
          <div class="temple-stage" aria-hidden="true">
            <div class="temple-moon-gate"></div>
            <div class="temple-orbit temple-orbit-one"></div>
            <div class="temple-orbit temple-orbit-two"></div>
            <div class="temple-platform"></div>
            <div class="temple-particles"></div>
          </div>
          <div class="pool-copy star-temple-panel command-sanctum">
            <p class="eyebrow">月白祈愿台</p>
            <h1>${escapeHtml(pool.name || "月白回响")}</h1>
            <p>在神殿月门前投入星辉，等待回响穿过云镜回应。</p>
            <div class="resource-board" aria-label="当前祈愿资源">
              <div class="resource-metre">
                <span>总祈愿</span>
                <strong>${appState.gachaState.totalPulls}</strong>
              </div>
              <div class="resource-metre">
                <span>月辉保底</span>
                <strong>${appState.gachaState.moonPity}/80</strong>
              </div>
              <div class="resource-metre">
                <span>星辉保底</span>
                <strong>${appState.gachaState.starPity}/10</strong>
              </div>
            </div>
            <div class="wish-altar">
              <span class="wish-emblem" aria-hidden="true"></span>
              ${button("pull-one", "祈愿一次", 'class="primary-action wish-once"')}
              ${button("pull-ten", "祈愿十次", 'class="primary-action pull-ten wish-ten"')}
              <div class="wish-console-secondary">
                ${button("open-gallery", "角色图鉴")}
                ${button("open-history", "祈愿记录")}
              </div>
            </div>
          </div>
          <section class="pool-spotlight" aria-label="本期限定角色">
            <div class="spotlight-card rarity-${escapeHtml(upCharacter.rarity || "moon")}">
              ${renderCharacterImage(upCharacter, { className: "spotlight-art card-art", mode: "hero", eager: true })}
              <div class="spotlight-copy">
                <span>限定 UP</span>
                <strong>${escapeHtml(upCharacter.name || "望月白音")}</strong>
                <em>${escapeHtml(upCharacter.title || "")}</em>
              </div>
            </div>
          </section>
          <aside class="pool-side-hud oracle-strip" aria-label="卡池情报">
            <div class="hud-card oracle-card">
              <span>神殿谕示</span>
              <strong>${guaranteeText}</strong>
              <small>抽取月辉时触发限定判定</small>
            </div>
            <div class="hud-card pool-rate-card">
              <span>基础概率</span>
              <strong>月辉 1.6%</strong>
              <small>星辉 10% / 微光 88.4%</small>
            </div>
            <div class="hud-card pool-rate-card">
              <span>演出节奏</span>
              <strong>完整祈愿演出</strong>
              <small>星门动画可在抽卡中跳过</small>
            </div>
          </aside>
        </section>
      </main>
    `;
  }

  function renderSummon() {
    const rarity = highestRarity(appState.activeBatch);
    return `
      <main class="view summon-view game-view" data-rarity="${escapeHtml(rarity)}">
        <section class="summon-stage wish-cinematic">
          <div class="screen-flash" aria-hidden="true"></div>
          <div class="wish-sky" aria-hidden="true">
            <div class="wish-moon"></div>
            <div class="wish-gate-aura"></div>
            <div class="wish-runes">
              <span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="wish-starfall">
              <span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="moon-gate star-gate">
              <div class="gate-ring"></div>
              <div class="gate-ring gate-ring-secondary"></div>
              <div class="gate-core"></div>
              <div class="light-trails"></div>
            </div>
          </div>
          <div class="wish-cinematic-copy">
            <p class="eyebrow">月门祈愿</p>
            <h1>星辉回应中</h1>
            <p>月白神殿回应了祈愿，回响即将降临。</p>
            <p class="rarity-forecast">${escapeHtml(rarityForecastLabel(rarity))}</p>
          </div>
          <div class="summon-readout audio-cue" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="summon-actions wish-skip-dock">
            ${button("skip", "跳过动画", 'class="primary-action"')}
          </div>
        </section>
      </main>
    `;
  }

  function renderResults() {
    const title = hasMoonResult() ? "月辉降临" : "星辉回应";
    const revealedCount = appState.activeBatch.length;
    const batchCount = appState.activeBatch.length || 1;
    const revealPercent = ((revealedCount / batchCount) * 100).toFixed(0);
    const bestResult = getBestResult(appState.activeBatch) || appState.activeBatch[0];
    const featuredResult = bestResult;
    const shouldShowResultRail = appState.activeBatch.length > 1;
    const counts = appState.activeBatch.reduce((summary, result) => {
      summary[result.rarity] += 1;
      return summary;
    }, { moon: 0, star: 0, glimmer: 0 });
    const items = appState.activeBatch
      .map((result) => {
        const focusClass = result.rarity === "moon" ? "is-moon-focus" : "";
        return `
          <li data-reveal-id="${escapeHtml(result.instanceId)}" class="result-item rarity-${escapeHtml(result.rarity)}" data-tone="${escapeHtml(rarityTone(result.rarity))}">
            ${renderCharacterCard(result, { className: focusClass })}
            <div class="result-card-actions">
              ${button("open-detail", "详情", `class="mini-action" data-id="${escapeHtml(result.id)}"`)}
            </div>
          </li>
        `;
      })
      .join("");

    return `
      <main class="view results-view game-view">
        ${renderGameChrome("results")}
        <section class="result-stage">
          <div class="result-header">
            <div>
              <p class="eyebrow">本次祈愿</p>
              <h1>${title}</h1>
            </div>
            <p class="result-summary">月辉 ${counts.moon} / 星辉 ${counts.star} / 微光 ${counts.glimmer}</p>
          </div>
          <div class="reveal-progress" aria-label="揭示进度">
            <span style="width: ${revealPercent}%"></span>
          </div>
          <div class="result-command-dock">
            ${button("pull-ten", "再祈愿十次", 'class="primary-action wish-ten"')}
            ${button("pull-one", "再祈愿一次")}
            ${button("back-pool", "返回神殿")}
          </div>
          <section class="result-spotlight result-hero-stage rarity-${escapeHtml(featuredResult.rarity || "glimmer")}" aria-label="重点回响">
            <div class="result-hero-backdrop" aria-hidden="true"></div>
            <div class="result-hero-aura" aria-hidden="true"></div>
            <div class="result-hero-visual">
              <div class="result-hero-ghost-art" aria-hidden="true">
                ${renderCharacterImage(featuredResult, { className: "result-spotlight-art card-art", mode: "hero", eager: true })}
              </div>
              <div class="result-hero-art-wrap">
                ${renderCharacterImage(featuredResult, { className: "result-spotlight-art card-art", mode: "hero", eager: true })}
              </div>
            </div>
            <div class="result-hero-copy-panel result-hero-info-strip result-spotlight-copy">
              <span class="result-hero-kicker">${escapeHtml(rarityTone(featuredResult.rarity || "glimmer"))}回响</span>
              <strong>${escapeHtml(featuredResult.name || "等待揭示")}</strong>
              <p>${escapeHtml(featuredResult.title || "星辉仍在汇聚")}</p>
              <div class="result-focus-actions">
                ${button("open-detail", "查看详情", `data-id="${escapeHtml(featuredResult.id || "")}"`)}
              </div>
            </div>
          </section>
          ${shouldShowResultRail ? `
            <div class="result-reveal-rail">
              <ul class="result-grid" data-count="${appState.activeBatch.length}" data-moon="${counts.moon > 0 ? "true" : "false"}">${items || "<li>暂无回响结果</li>"}</ul>
            </div>
          ` : ""}
        </section>
      </main>
    `;
  }

  function renderHistory() {
    const historyGroups = buildHistoryGroups();
    const items = historyGroups
      .map((group) => {
        const upMarker = group.isRateUp ? '<span class="up-marker">UP</span>' : "";
        const pullText = group.latestPullNumber ? `最近 #${group.latestPullNumber}` : "最近";
        const actionAttribute = group.id ? ` data-action="open-detail" data-id="${escapeHtml(group.id)}"` : "";
        const characterForArt = group.character && group.character.id ? group.character : getCharacter(group.id) || {};
        return `
          <li>
            <button type="button" class="history-character-card rarity-${escapeHtml(group.rarity)}"${actionAttribute}>
              ${renderCharacterImage(characterForArt, { className: "history-character-art card-art", mode: "card", tag: "span" })}
              <span class="history-character-copy">
                <span class="history-pull">${escapeHtml(pullText)}</span>
                <strong>${escapeHtml(group.name)}</strong>
                <span>${escapeHtml(group.rarityLabel)}</span>
                <span>${escapeHtml(group.title || group.faction || "回响档案")} ${upMarker}</span>
                <span class="history-count">获得 ${group.count} 次</span>
                <time datetime="${escapeHtml(group.latestTimestamp || "")}">最近 ${escapeHtml(formatLocalTime(group.latestTimestamp))}</time>
              </span>
            </button>
          </li>
        `;
      })
      .join("");

    return `
      <main class="view history-view game-view archive-page archive-shell">
        ${renderGameChrome("history")}
        <div class="view-header archive-header archive-toolbar">
          <div>
            <p class="eyebrow">祈愿记录</p>
            <h1>星轨档案</h1>
          </div>
          <div class="history-top-actions">
            ${button("reset-data", "清空数据")}
            ${button("back-pool", "返回神殿")}
          </div>
        </div>
        <ul class="history-character-list">${items || '<li class="empty-state">还没有回响记录</li>'}</ul>
      </main>
    `;
  }

  function renderGallery() {
    const filters = [
      ["all", "全部"],
      ["moon", "月辉"],
      ["star", "星辉"],
      ["glimmer", "微光"],
      ["owned", "已获得"],
      ["missing", "未获得"]
    ];
    const filteredCharacters = characters.filter((character) => {
      if (appState.galleryFilter === "owned") return isOwned(character.id);
      if (appState.galleryFilter === "missing") return !isOwned(character.id);
      if (appState.galleryFilter === "all") return true;
      return character.rarity === appState.galleryFilter;
    });
    const filterButtons = filters
      .map(([filter, label]) => {
        const active = appState.galleryFilter === filter ? 'class="is-active" aria-pressed="true"' : 'aria-pressed="false"';
        return button("filter-gallery", label, `${active} data-filter="${filter}"`);
      })
      .join("");
    const items = filteredCharacters
      .map((character, index) => {
        const count = getOwnedCount(character.id);
        const ownedClass = count > 0 ? "is-owned" : "is-unowned";
        const ownedLabel = count > 0 ? `已获得 ${count}` : "未获得";
        return `
          <li>
            <button type="button" class="gallery-card ${ownedClass} rarity-${escapeHtml(character.rarity || "glimmer")}" data-action="open-detail" data-id="${escapeHtml(character.id)}">
              ${renderCharacterImage(character, { className: "gallery-art card-art", mode: "card", tag: "span", eager: index < 6 })}
              <span class="gallery-copy">
                <span class="rarity-label">${escapeHtml(character.rarityLabel || "")}</span>
                <strong>${escapeHtml(character.name || "未知回响")}</strong>
                <span>${escapeHtml(character.role || "")} · ${escapeHtml(character.element || "")}</span>
                <span>${escapeHtml(character.faction || "")}</span>
                <span>${escapeHtml(ownedLabel)}</span>
              </span>
            </button>
          </li>
        `;
      })
      .join("");

    return `
      <main class="view gallery-view game-view archive-page archive-shell">
        ${renderGameChrome("gallery")}
        <div class="view-header archive-header archive-toolbar">
          <div>
            <p class="eyebrow">角色图鉴</p>
            <h1>回响档案</h1>
            <p class="archive-count">${filteredCharacters.length} / ${characters.length} 名回响</p>
          </div>
          ${button("back-pool", "返回神殿")}
        </div>
        <div class="filter-bar" role="toolbar" aria-label="图鉴筛选">${filterButtons}</div>
        <ul class="gallery-grid">${items || '<li class="empty-state">暂无符合条件的回响</li>'}</ul>
      </main>
    `;
  }

  function renderDetail() {
    const character = getCharacter(appState.selectedCharacterId) || characters[0] || {};
    const owned = appState.collection[character.id];
    const count = getOwnedCount(character.id);
    const firstObtained = owned && owned.firstObtainedAt ? formatLocalTime(owned.firstObtainedAt) : "";
    const profile = character.profile || {};
    const obtainedText = count > 0
      ? `<p><strong>已获得</strong> ${count} 次</p><p><strong>初遇时间</strong> ${escapeHtml(firstObtained)}</p>`
      : "<p><strong>已获得</strong> 0 次</p>";
    preloadImage(imageSource(character, "full"));
    return `
      <main class="view view-detail game-view archive-page archive-shell">
        ${renderGameChrome("detail")}
        <section class="detail-layout character-dossier dossier-hero">
          <div class="detail-art-frame">
            ${renderCharacterImage(character, { className: "detail-art card-art", mode: "full", eager: true })}
          </div>
          <div class="detail-copy">
            <p class="rarity-label">${escapeHtml(character.rarityLabel || "")}</p>
            <h1>${escapeHtml(character.name || "未知回响")}</h1>
            <p class="detail-title">${escapeHtml(character.title || "")}</p>
            <dl class="detail-meta">
              <div><dt>阵营</dt><dd>${escapeHtml(character.faction || "")}</dd></div>
              <div><dt>元素</dt><dd>${escapeHtml(character.element || "")}</dd></div>
              <div><dt>定位</dt><dd>${escapeHtml(character.role || "")}</dd></div>
            </dl>
            <dl class="profile-strip">
              <div><dt>生日</dt><dd>${escapeHtml(profile.birthday || "")}</dd></div>
              <div><dt>身高</dt><dd>${escapeHtml(profile.height || "")}</dd></div>
              <div><dt>战斗方式</dt><dd>${escapeHtml(profile.combatStyle || "")}</dd></div>
              <div><dt>信赖物</dt><dd>${escapeHtml(profile.trustItem || "")}</dd></div>
            </dl>
            <blockquote class="detail-quote">${escapeHtml(character.quote || "")}</blockquote>
            <section class="detail-story">
              <h2>角色小传</h2>
              <p>${escapeHtml(character.story || character.bio || "")}</p>
            </section>
            <section class="detail-archive">
              <h2>档案记录</h2>
              ${renderArchiveList(character)}
            </section>
            <div class="detail-owned">${obtainedText}</div>
          </div>
        </section>
        <div class="detail-dock dossier-actions">
          ${button("open-gallery", "返回图鉴")}
          ${button("back-pool", "返回神殿")}
        </div>
      </main>
    `;
  }

  function render() {
    const pool = getActivePool();
    const nextView = appState.view;
    const shouldResetScroll = lastRenderedView && lastRenderedView !== nextView;
    root.dataset.view = appState.view;
    let html = "";

    if (appState.view === "summon") {
      html = renderSummon();
    } else if (appState.view === "results") {
      html = renderResults();
    } else if (appState.view === "history") {
      html = renderHistory();
    } else if (appState.view === "gallery") {
      html = renderGallery();
    } else if (appState.view === "detail") {
      html = renderDetail();
    } else {
      html = renderPool(pool);
    }

    root.innerHTML = html;
    if (shouldResetScroll) {
      scheduleScrollToTop();
    }
    lastRenderedView = nextView;
  }

  root.addEventListener("click", (event) => {
    if (!(event.target instanceof window.Element)) return;

    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    if (action === "pull-one") startPull(1);
    if (action === "pull-ten") startPull(10);
    if (action === "skip") revealAll();
    if (action === "back-pool") setView("pool");
    if (action === "open-history") setView("history");
    if (action === "open-gallery") setView("gallery");
    if (action === "filter-gallery") setGalleryFilter(target.dataset.filter || "all");
    if (action === "open-detail") {
      appState.selectedCharacterId = target.dataset.id || "";
      setView("detail");
    }
    if (action === "reset-data") resetLocalData();
  });

  loadState();
  render();

  window.MoonwhiteApp = {
    appState,
    loadState,
    saveState,
    mergeCollection,
    appendHistory,
    resetLocalData,
    setView,
    setGalleryFilter,
    startPull,
    revealAll,
    hasMoonResult,
    highestRarity,
    handleCardImageError,
    render
  };
})(window, document);
