const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const styles = fs.existsSync(path.join(root, "styles.css")) ? fs.readFileSync(path.join(root, "styles.css"), "utf8") : "";
const imageScriptPath = path.join(root, "scripts/generate-character-art.js");

function testScriptOrder() {
  const order = [
    "./data/characters.js",
    "./data/pools.js",
    "./gacha-engine.js",
    "./app.js"
  ].map((needle) => html.indexOf(needle));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.ok(order.every((index) => index > -1));
}

function testRequiredStorageKeys() {
  ["moonwhiteEchoes.gachaState", "moonwhiteEchoes.history", "moonwhiteEchoes.collection"].forEach((key) => {
    assert.ok(app.includes(key), `${key} missing`);
  });
  assert.ok(!app.includes("moonwhiteEchoes.settings"), "settings storage should be removed");
}

function testRequiredViewsAndActions() {
  ["pool", "summon", "results", "history", "gallery", "detail"].forEach((view) => {
    assert.ok(app.includes(view), `${view} view missing`);
  });
  ["祈愿一次", "祈愿十次", "月辉降临", "跳过", "角色图鉴", "祈愿记录"].forEach((label) => {
    assert.ok(app.includes(label), `${label} label missing`);
  });
  ["全部", "月辉", "星辉", "微光", "已获得", "未获得", "清空数据", "确定清空全部本地数据吗？"].forEach((label) => {
    assert.ok(app.includes(label), `${label} missing`);
  });
  assert.ok(!app.includes("清空历史"), "history-only clear label should be removed");
  assert.ok(!app.includes("clear-history"), "history-only clear action should be removed");
}

function testStateSafetyMarkers() {
  ["instanceId", "firstObtainedAt", "lastObtainedAt", "duplicateCount"].forEach((marker) => {
    assert.ok(app.includes(marker), `${marker} missing`);
  });
  ["isArray", "isPlainObject", "normalizeGachaState"].forEach((helper) => {
    assert.ok(app.includes(helper), `${helper} validation helper missing`);
  });
  assert.ok(app.includes("root.addEventListener"), "events should be delegated from root");
  assert.ok(!app.includes("document.addEventListener"), "document-level event delegation should not be used");
}

function testPlayableFlowSafetyMarkers() {
  ["summonTimerId", "activePullToken", "clearSummonTimer"].forEach((marker) => {
    assert.ok(app.includes(marker), `${marker} missing`);
  });
  assert.ok(app.includes("window.clearTimeout"), "summon timeout should be cleared explicitly");
  assert.ok(app.includes("pullToken === activePullToken"), "summon timeout should be scoped to the active pull");
  assert.ok(app.includes("revealAll"), "revealAll should be present");
}

function testImageFallbackMarkers() {
  ["handleCardImageError", "is-missing", "card-art-fallback", "imageSource", "fallbackImageSource", "data-fallback-src", "loading=\"lazy\"", "decoding=\"async\""].forEach((marker) => {
    assert.ok(app.includes(marker), `${marker} missing`);
  });
  assert.ok(app.includes("preloadImage"), "hero image preload helper missing");
  assert.ok(app.includes('onerror="window.MoonwhiteApp.handleCardImageError(this)"'), "card images need an error fallback");
  assert.ok(app.includes("delete image.dataset.fallbackSrc"), "failed thumbnails should retry the full source before showing fallback");
  assert.ok(styles.includes(".card-art.is-missing"), "missing-art CSS state missing");
  assert.ok(styles.includes(".card-art-fallback"), "fallback CSS marker missing");
}

function testCharacterStoryUiMarkers() {
  ["renderArchiveList", "character.story", "profile.height", "profile.birthday", "profile.combatStyle", "profile.trustItem"].forEach((marker) => {
    assert.ok(app.includes(marker), `${marker} missing`);
  });
  ["detail-story", "archive-list", "profile-strip"].forEach((marker) => {
    assert.ok(styles.includes(marker), `${marker} CSS missing`);
  });
}

function testAnimationPolishMarkers() {
  ["highestRarity", "data-rarity", "wish-cinematic", "wish-sky", "wish-moon", "wish-runes", "wish-starfall", "rarity-forecast"].forEach((marker) => {
    assert.ok(app.includes(marker), `${marker} missing`);
  });
  ["moonGateBloom", "wishStarfall", "runeOrbit", "cardReveal", "moonPulse"].forEach((keyframe) => {
    assert.ok(styles.includes(keyframe), `${keyframe} keyframe missing`);
  });
  ["星辉回应", "微光浮现", "is-moon-focus", "result-summary", "320"].forEach((marker) => {
    assert.ok(app.includes(marker) || styles.includes(marker), `${marker} missing`);
  });
}

function testRitualRebuildMarkers() {
  [
    "ritual-hub",
    "pool-spotlight",
    "wish-altar",
    "resource-metre",
    "oracle-strip",
    "quick-orb-nav",
    "pool-rate-card",
    "wish-cinematic",
    "wish-skip-dock",
    "screen-flash",
    "audio-cue",
    "result-spotlight",
    "result-reveal-rail",
    "result-focus-actions",
    "result-hero-visual",
    "result-hero-info-strip",
    "archive-shell",
    "archive-toolbar",
    "dossier-hero",
    "dossier-actions"
  ].forEach((marker) => {
    assert.ok(app.includes(marker), `${marker} app marker missing`);
  });

  [
    "Ritual game UI rebuild pass",
    "wish-emblem.svg",
    "moon-rarity-flare.svg",
    "star-rarity-flare.svg",
    "pageFade",
    "Wish cinematic rebuild",
    "moonGateBloom",
    "wishStarfall",
    "rarityBurst",
    "foilSweep",
    "buttonPress",
    "will-change",
    "content-visibility",
    "--ritual-gold",
    "--ritual-celeste"
  ].forEach((marker) => {
    assert.ok(styles.includes(marker), `${marker} CSS rebuild marker missing`);
  });
}

function testSimplifiedAnimationControls() {
  [
    "自动揭示",
    "低动效",
    "演出设置",
    "全部揭示",
    "立即揭示",
    "蓄力",
    "光轨飞行",
    "回响揭示",
    "toggle-auto-reveal",
    "toggle-motion",
    "autoReveal",
    "reduceMotion",
    "settings-drawer",
    "reveal-next",
    "reveal-all",
    "queueAutoReveal"
  ].forEach((marker) => {
    assert.ok(!app.includes(marker), `${marker} should be removed from app controls`);
  });

  assert.ok(app.includes("跳过动画"), "summon view should keep skip animation control");
  assert.ok(app.includes("appState.revealedIds = appState.activeBatch.map"), "results should be fully revealed by default");
  assert.ok(app.includes("}, 1650);"), "summon animation should use the full default timing");
  assert.ok(!styles.includes(".settings-drawer"), "settings drawer CSS should be removed");
}

function testNoMarkingUiAndState() {
  const { moonwhiteApp } = createVmApp();
  ["加入标记", "取消标记", "已标记", "toggle-favorite", "favorite", "favorites", "mark-action", "favorite-ribbon"].forEach((marker) => {
    assert.ok(!app.includes(marker), `${marker} should be removed from app`);
    assert.ok(!styles.includes(marker), `${marker} should be removed from styles`);
  });
  assert.equal(Object.prototype.hasOwnProperty.call(moonwhiteApp.appState, "favorites"), false, "favorites state should be removed");
  assert.equal(Object.prototype.hasOwnProperty.call(moonwhiteApp, "toggleFavorite"), false, "favorite toggle API should be removed");
}

function countOccurrences(value, needle) {
  return (value.match(new RegExp(needle, "g")) || []).length;
}

function testResultsRevealAllByDefault() {
  const { moonwhiteApp, windowMock, timers } = createVmApp({
    setTimeout(callback) {
      const timer = { callback, cleared: false };
      timers.push(timer);
      return timers.length;
    },
    clearTimeout(id) {
      const timer = timers[id - 1];
      if (timer) timer.cleared = true;
    }
  });
  moonwhiteApp.startPull(10);
  timers[0].callback();

  assert.equal(moonwhiteApp.appState.view, "results", "summon timer should move to results");
  assert.equal(moonwhiteApp.appState.revealedIds.length, moonwhiteApp.appState.activeBatch.length, "all cards should be revealed when results open");
  assert.equal(windowMock.rootElement.innerHTML.includes("card-back"), false, "result page should not show unrevealed card backs");
  assert.equal(countOccurrences(windowMock.rootElement.innerHTML, "is-just-revealed"), 0, "default full reveal should not flash individual cards");
}

function testSinglePullDoesNotDuplicateResultRail() {
  const single = createVmApp({
    setTimeout(callback) {
      single.timers.push({ callback });
      return single.timers.length;
    },
    clearTimeout() {}
  });
  single.moonwhiteApp.startPull(1);
  single.timers[0].callback();
  assert.equal(single.windowMock.rootElement.innerHTML.includes("result-reveal-rail"), false, "single pull should not duplicate the spotlight with a lower result rail");
  assert.equal(single.windowMock.rootElement.innerHTML.includes("result-grid"), false, "single pull should not render a lower result grid");

  const ten = createVmApp({
    setTimeout(callback) {
      ten.timers.push({ callback });
      return ten.timers.length;
    },
    clearTimeout() {}
  });
  ten.moonwhiteApp.startPull(10);
  ten.timers[0].callback();
  assert.equal(ten.windowMock.rootElement.innerHTML.includes("result-reveal-rail"), true, "ten pull should keep the lower result rail");
  assert.equal(countOccurrences(ten.windowMock.rootElement.innerHTML, "result-item"), 10, "ten pull should still show all result cards");
}

function testResultSpotlightStageDesignMarkers() {
  [
    "result-hero-stage",
    "result-hero-backdrop",
    "result-hero-aura",
    "result-hero-visual",
    "result-hero-art-wrap",
    "result-hero-copy-panel",
    "result-hero-info-strip",
    "result-hero-kicker"
  ].forEach((marker) => {
    assert.ok(app.includes(marker), `${marker} app marker missing`);
  });

  [
    "Result spotlight stage redesign",
    "Spotlight image and info split",
    "Spotlight impact pass",
    ".result-hero-stage",
    ".result-hero-visual",
    ".result-hero-ghost-art",
    ".result-hero-art-wrap",
    ".result-hero-copy-panel",
    ".result-hero-info-strip",
    "grid-template-rows",
    "clip-path: polygon",
    "backdrop-filter",
    "@media (max-width: 720px)"
  ].forEach((marker) => {
    assert.ok(styles.includes(marker), `${marker} CSS spotlight marker missing`);
  });
}

function testHistoryUsesCharacterGroupsAndTopActions() {
  [
    "buildHistoryGroups",
    "history-top-actions",
    "history-character-list",
    "history-character-card",
    "history-count",
    "最近"
  ].forEach((marker) => {
    assert.ok(app.includes(marker), `${marker} history grouping marker missing`);
  });

  const { moonwhiteApp, windowMock } = createVmApp();
  moonwhiteApp.appState.history = [
    { id: "lunara", name: "望月白音", rarity: "moon", rarityLabel: "月辉 ★★★★★", pullNumber: 10, timestamp: "2026-05-14T07:27:00.000Z" },
    { id: "lunara", name: "望月白音", rarity: "moon", rarityLabel: "月辉 ★★★★★", pullNumber: 2, timestamp: "2026-05-14T07:10:00.000Z" },
    { id: "ioren", name: "砂鸢", rarity: "star", rarityLabel: "星辉 ★★★★", pullNumber: 11, timestamp: "2026-05-14T07:28:00.000Z" }
  ];
  moonwhiteApp.setView("history");

  assert.equal(countOccurrences(windowMock.rootElement.innerHTML, "history-character-card"), 2, "history should render one card per character");
  assert.ok(windowMock.rootElement.innerHTML.includes("获得 2 次"), "duplicate character pulls should be counted");
  assert.ok(windowMock.rootElement.innerHTML.includes("history-top-actions"), "history actions should live in the header");
  assert.ok(windowMock.rootElement.innerHTML.includes('data-action="reset-data"'), "history should clear all data from the top actions");
  assert.ok(windowMock.rootElement.innerHTML.includes("清空数据"), "history should label the reset action clearly");
  assert.ok(!windowMock.rootElement.innerHTML.includes('<div class="actions">'), "history page should not keep bottom actions");
}

function testImageFallbackRetriesFullArt() {
  const { moonwhiteApp } = createVmApp();
  const art = {
    classList: {
      added: [],
      add(value) {
        this.added.push(value);
      }
    },
    setAttribute(name, value) {
      this[name] = value;
    }
  };
  const image = {
    dataset: { fallbackSrc: "./assets/characters/01.png" },
    src: "./assets/characters/thumbs/01.jpg",
    hidden: false,
    removeAttribute(name) {
      delete this[name];
    },
    closest() {
      return art;
    }
  };
  moonwhiteApp.handleCardImageError(image);
  assert.equal(image.src, "./assets/characters/01.png", "thumbnail errors should retry full artwork");
  assert.equal(image.hidden, false, "image should stay visible while retrying full artwork");
  assert.equal(image.dataset.fallbackSrc, undefined, "fallback source should only be retried once");
}

function testMobileUsabilityMarkers() {
  const resultsActionsIndex = app.indexOf('class="result-command-dock"');
  const resultGridIndex = app.indexOf('<ul class="result-grid"');
  assert.ok(resultsActionsIndex > -1, "result command dock should be marked");
  assert.ok(resultGridIndex > -1, "result grid should be present");
  assert.ok(resultsActionsIndex < resultGridIndex, "result command dock should be reachable before the card grid");
  assert.ok(app.includes('tag: "span"'), "gallery art inside buttons should avoid block div wrappers");

  [
    "Usability pass",
    "Star temple redesign pass",
    "Full game UI overhaul pass",
    "star-temple-bg.png",
    "summon-gate-bg.png",
    "result-stage-bg.png",
    "game-chrome",
    "result-command-dock",
    "temple-stage",
    "wish-ten",
    ".pool-copy .action-row",
    ".pool-copy .pool-panels",
    "repeat(auto-fill, minmax(140px, 180px))",
    "max-width: 180px",
    "overflow-x: auto",
    ".gallery-view .filter-bar button",
    "grid-template-columns: repeat(2, minmax(0, 1fr));"
  ].forEach((marker) => {
    assert.ok(styles.includes(marker), `${marker} mobile usability marker missing`);
  });
}

function testDarkRitualButtonThemeMarkers() {
  [
    "Dark ritual button restyle",
    "--button-dark-base",
    "--button-dark-edge",
    "--button-dark-glow",
    ".primary-action",
    ".wish-ten",
    ".result-command-dock button",
    ".history-top-actions button",
    ".gallery-view .filter-bar button.is-active",
    ".chrome-nav-button.is-active"
  ].forEach((marker) => {
    assert.ok(styles.includes(marker), `${marker} dark button marker missing`);
  });

  assert.ok(styles.includes("rgba(10, 16, 30, 0.92)"), "primary dark button fill missing");
  assert.ok(styles.includes("0 0 0 1px rgba(244, 212, 129, 0.32) inset"), "dark button inner edge missing");
}

function testDesktopSpotlightCompositionMarkers() {
  [
    "Desktop spotlight composition pass",
    "@media (min-width: 900px)",
    "grid-template-columns: minmax(18rem, 38%) minmax(0, 1fr)",
    "grid-column: 1",
    "grid-column: 2",
    "result-hero-intro-panel",
    "result-hero-lore",
    "result-hero-tags",
    ".result-hero-copy-panel.result-hero-info-strip",
    "grid-template-columns: 1fr",
    ".result-hero-info-strip .result-focus-actions"
  ].forEach((marker) => {
    assert.ok(styles.includes(marker), `${marker} desktop spotlight marker missing`);
  });
  ["result-hero-intro-panel", "result-hero-lore", "result-hero-tags", "人物小传"].forEach((marker) => {
    assert.ok(app.includes(marker), `${marker} spotlight intro app marker missing`);
  });
}

function testResultSpotlightShowsSideIntroduction() {
  const { moonwhiteApp, windowMock, timers } = createVmApp({
    setTimeout(callback) {
      timers.push({ callback });
      return timers.length;
    },
    clearTimeout() {}
  });
  moonwhiteApp.startPull(1);
  timers[0].callback();

  assert.ok(windowMock.rootElement.innerHTML.includes("result-hero-intro-panel"), "spotlight should use a right-side intro panel");
  assert.ok(windowMock.rootElement.innerHTML.includes("result-hero-lore"), "spotlight should include character lore");
  assert.ok(windowMock.rootElement.innerHTML.includes("人物小传"), "spotlight should label the character introduction");
  assert.ok(windowMock.rootElement.innerHTML.includes("result-hero-tags"), "spotlight should show character tags");
}

function testReadmeIsPublicShareFocused() {
  ["在线试玩", "特色", "声明", "License"].forEach((marker) => {
    assert.ok(readme.includes(marker), `${marker} README marker missing`);
  });
  ["## 本地运行", "## 部署", "## 开发"].forEach((marker) => {
    assert.ok(!readme.includes(marker), `${marker} should be removed from public README`);
  });
}

function testImageGenerationScriptMarkers() {
  const script = fs.readFileSync(imageScriptPath, "utf8");
  ["--dry-run", "--all", "--id", "--overwrite", "OPENAI_API_KEY", "gpt-image-2"].forEach((needle) => {
    assert.ok(script.includes(needle), `${needle} missing from generation script`);
  });
  ["output_format", "getOutputFormat", "1024x1536", "tmp"].forEach((needle) => {
    assert.ok(script.includes(needle), `${needle} missing from generation script`);
  });
  assert.ok(script.includes('"png"'), "generation script should support PNG output");
}

function testStartPullTimeoutIsOwnedByCurrentBatch() {
  const vm = require("node:vm");
  const characters = require(path.join(root, "data/characters.js"));
  const pools = require(path.join(root, "data/pools.js"));
  const engine = require(path.join(root, "gacha-engine.js"));
  const timers = [];
  let nextTimerId = 1;

  const rootElement = {
    dataset: {},
    innerHTML: "",
    addEventListener() {}
  };
  const windowMock = {
    MoonwhiteCharacters: characters,
    MoonwhitePools: pools,
    MoonwhiteGachaEngine: engine,
    Element: function Element() {},
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {}
    },
    setTimeout(callback) {
      const timer = { id: nextTimerId, callback, cleared: false };
      nextTimerId += 1;
      timers.push(timer);
      return timer.id;
    },
    clearTimeout(id) {
      const timer = timers.find((item) => item.id === id);
      if (timer) timer.cleared = true;
    }
  };
  const documentMock = {
    getElementById(id) {
      return id === "app" ? rootElement : null;
    }
  };
  const context = {
    window: windowMock,
    document: documentMock,
    Math: {
      ...Math,
      random() {
        return 0.99;
      }
    },
    Date
  };

  vm.runInNewContext(app, context);
  windowMock.MoonwhiteApp.startPull(1);
  windowMock.MoonwhiteApp.revealAll();
  windowMock.MoonwhiteApp.startPull(1);

  assert.equal(windowMock.MoonwhiteApp.appState.view, "summon");
  assert.equal(timers[0].cleared, true, "first summon timer should be cleared before the second pull");
  timers[0].callback();
  assert.equal(windowMock.MoonwhiteApp.appState.view, "summon", "stale timer should not reveal a newer pull");
  timers[1].callback();
  assert.equal(windowMock.MoonwhiteApp.appState.view, "results", "current timer should reveal the active pull");
}

function createVmApp(overrides) {
  const vm = require("node:vm");
  const characters = require(path.join(root, "data/characters.js"));
  const pools = require(path.join(root, "data/pools.js"));
  const engine = require(path.join(root, "gacha-engine.js"));
  const storedValues = new Map();
  const timers = [];

  const rootElement = {
    dataset: {},
    innerHTML: "",
    addEventListener(type, listener) {
      this.listener = listener;
    }
  };
  const windowMock = {
    MoonwhiteCharacters: characters,
    MoonwhitePools: pools,
    MoonwhiteGachaEngine: engine,
    Element: function Element() {},
    localStorage: {
      getItem(key) {
        return storedValues.get(key) || null;
      },
      setItem(key, value) {
        storedValues.set(key, value);
      }
    },
    setTimeout: overrides && overrides.setTimeout ? overrides.setTimeout : function setTimeout() {
      return 1;
    },
    clearTimeout: overrides && overrides.clearTimeout ? overrides.clearTimeout : function clearTimeout() {},
    confirm() {
      return true;
    }
  };
  const documentMock = {
    getElementById(id) {
      return id === "app" ? rootElement : null;
    }
  };
  const context = {
    window: windowMock,
    document: documentMock,
    Math,
    Date
  };

  vm.runInNewContext(app, context);
  windowMock.rootElement = rootElement;
  return { moonwhiteApp: windowMock.MoonwhiteApp, windowMock, timers };
}

function testResetDataRequiresConfirmation() {
  const { moonwhiteApp, windowMock } = createVmApp();
  moonwhiteApp.appState.history = [{ name: "露娜拉", rarityLabel: "月辉 ★★★★★", pullNumber: 1, timestamp: "2026-04-30T00:00:00.000Z" }];
  moonwhiteApp.appState.collection = { lunara: { id: "lunara", count: 2 } };
  moonwhiteApp.appState.gachaState.totalPulls = 12;
  moonwhiteApp.resetLocalData();
  assert.equal(moonwhiteApp.appState.history.length, 0, "confirmed reset should empty history");
  assert.equal(Object.keys(moonwhiteApp.appState.collection).length, 0, "confirmed reset should empty collection");
  assert.equal(moonwhiteApp.appState.gachaState.totalPulls, 0, "confirmed reset should reset gacha state");

  moonwhiteApp.appState.history = [{ name: "瑟兰", rarityLabel: "月辉 ★★★★★", pullNumber: 2, timestamp: "2026-04-30T00:00:00.000Z" }];
  moonwhiteApp.appState.collection = { seren: { id: "seren", count: 1 } };
  moonwhiteApp.appState.gachaState.totalPulls = 9;
  windowMock.confirm = () => false;
  moonwhiteApp.resetLocalData();
  assert.equal(moonwhiteApp.appState.history.length, 1, "cancelled reset should preserve history");
  assert.equal(Object.keys(moonwhiteApp.appState.collection).length, 1, "cancelled reset should preserve collection");
  assert.equal(moonwhiteApp.appState.gachaState.totalPulls, 9, "cancelled reset should preserve gacha state");
}

function testGalleryFilterState() {
  const { moonwhiteApp } = createVmApp();
  assert.equal(moonwhiteApp.appState.galleryFilter, "all");
  moonwhiteApp.setGalleryFilter("owned");
  assert.equal(moonwhiteApp.appState.galleryFilter, "owned");
  moonwhiteApp.setGalleryFilter("missing");
  assert.equal(moonwhiteApp.appState.galleryFilter, "missing");
}

testScriptOrder();
testRequiredStorageKeys();
testRequiredViewsAndActions();
testStateSafetyMarkers();
testPlayableFlowSafetyMarkers();
testImageFallbackMarkers();
testCharacterStoryUiMarkers();
testAnimationPolishMarkers();
testRitualRebuildMarkers();
testSimplifiedAnimationControls();
testMobileUsabilityMarkers();
testDarkRitualButtonThemeMarkers();
testDesktopSpotlightCompositionMarkers();
testResultSpotlightShowsSideIntroduction();
testReadmeIsPublicShareFocused();
testImageGenerationScriptMarkers();
testStartPullTimeoutIsOwnedByCurrentBatch();
testResetDataRequiresConfirmation();
testGalleryFilterState();
testNoMarkingUiAndState();
testResultsRevealAllByDefault();
testSinglePullDoesNotDuplicateResultRail();
testResultSpotlightStageDesignMarkers();
testHistoryUsesCharacterGroupsAndTopActions();
testImageFallbackRetriesFullArt();
console.log("static UI checks passed");
