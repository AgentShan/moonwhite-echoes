const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const characters = require("../data/characters.js");
const poolConfig = require("../data/pools.js");
const {
  createInitialGachaState,
  drawBatch,
  getActivePool,
  getCharactersByRarity,
  selectRarity,
  summarizeHistoryEntry
} = require("../gacha-engine.js");

const activePool = getActivePool(poolConfig);
const root = path.resolve(__dirname, "..");

function rngFrom(values) {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1];
    index += 1;
    return value;
  };
}

function testCharacterCounts() {
  assert.equal(characters.length, 24);
  assert.equal(getCharactersByRarity(characters, "moon").length, 5);
  assert.equal(getCharactersByRarity(characters, "star").length, 8);
  assert.equal(getCharactersByRarity(characters, "glimmer").length, 11);
  assert.equal(characters.filter((character) => character.isRateUp).length, 1);
}

function testCharacterRosterIsAllFemale() {
  const maleMarkers = [/\bboy\b/i, /\bmale\b/i, /\byoung man\b/i, /少年/, /青年/, /男/];
  const femaleMarker = /\b(female|girl|woman|swordswoman|heroine)\b/i;
  characters.forEach((character) => {
    const searchableText = [
      character.name,
      character.title,
      character.quote,
      character.bio,
      character.prompt
    ].join(" ");
    assert.match(character.prompt, femaleMarker, `${character.id} prompt should explicitly request a female character`);
    maleMarkers.forEach((marker) => {
      assert.ok(!marker.test(searchableText), `${character.id} still contains male marker ${marker}`);
    });
  });
}

function testCharacterNameStyleRatio() {
  const counts = characters.reduce((accumulator, character) => {
    assert.ok(!/[A-Za-z]/.test(character.name), `${character.id} name should avoid latin letters`);
    accumulator[character.nameStyle] = (accumulator[character.nameStyle] || 0) + 1;
    return accumulator;
  }, {});
  assert.deepEqual(counts, {
    japanese: 12,
    chinese: 12
  });
}

function testCharacterImagesExist() {
  characters.forEach((character) => {
    const imagePath = path.join(root, character.image.replace(/^\.\//, ""));
    assert.ok(fs.existsSync(imagePath), `${character.id} image is missing: ${character.image}`);
    assert.ok(character.thumbnail, `${character.id} thumbnail is missing from data`);
    const thumbnailPath = path.join(root, character.thumbnail.replace(/^\.\//, ""));
    assert.ok(fs.existsSync(thumbnailPath), `${character.id} thumbnail file is missing: ${character.thumbnail}`);
  });
}

function testCharacterStoriesArePresent() {
  characters.forEach((character) => {
    assert.ok(character.profile && character.profile.height, `${character.id} profile height missing`);
    assert.ok(character.profile && character.profile.birthday, `${character.id} profile birthday missing`);
    assert.ok(character.profile && character.profile.combatStyle, `${character.id} combat style missing`);
    assert.ok(character.profile && character.profile.trustItem, `${character.id} trust item missing`);
    assert.ok(typeof character.story === "string" && character.story.length >= 80, `${character.id} story is too thin`);
    assert.ok(Array.isArray(character.archive) && character.archive.length >= 3, `${character.id} archive needs at least three entries`);
  });
}

function testHardPityForcesMoon() {
  const state = createInitialGachaState();
  state.moonPity = 79;
  const result = drawBatch({ count: 1, state, pool: activePool, characters, rng: rngFrom([0.99, 0.99, 0.99]) });
  assert.equal(result.results[0].rarity, "moon");
  assert.equal(result.nextState.moonPity, 0);
}

function testTenPullGuaranteePromotesStar() {
  const state = createInitialGachaState();
  const result = drawBatch({ count: 10, state, pool: activePool, characters, rng: rngFrom([0.99]) });
  assert.ok(result.results.some((item) => item.rarity === "star" || item.rarity === "moon"));
  assert.equal(result.results.length, 10);
}

function testStarPityForcesStarOnSinglePull() {
  const state = createInitialGachaState();
  state.starPity = 9;
  const rarity = selectRarity(state, activePool, 0.99);
  const moonPrecedence = selectRarity({ moonPity: 79, starPity: 9 }, activePool, 0.99);
  const result = drawBatch({ count: 1, state, pool: activePool, characters, rng: rngFrom([0.99, 0.1]) });
  assert.equal(rarity, "star");
  assert.equal(moonPrecedence, "moon");
  assert.ok(result.results[0].rarity === "star" || result.results[0].rarity === "moon");
  assert.equal(result.nextState.starPity, 0);
}

function testRateUpGuaranteeAfterLosingFiftyFifty() {
  const state = createInitialGachaState();
  state.moonPity = 79;
  const first = drawBatch({ count: 1, state, pool: activePool, characters, rng: rngFrom([0.99, 0.75, 0.4]) });
  assert.equal(first.results[0].rarity, "moon");
  assert.equal(first.results[0].isRateUp, false);
  assert.equal(first.nextState.guaranteedRateUp, true);

  first.nextState.moonPity = 79;
  const second = drawBatch({ count: 1, state: first.nextState, pool: activePool, characters, rng: rngFrom([0.99, 0.99, 0.2]) });
  assert.equal(second.results[0].id, activePool.rateUpCharacterId);
  assert.equal(second.results[0].isRateUp, true);
  assert.equal(second.nextState.guaranteedRateUp, false);
}

function testSoftPityIncreasesMoonRate() {
  const low = selectRarity({ moonPity: 10, starPity: 0 }, activePool, 0.5);
  const high = selectRarity({ moonPity: 70, starPity: 0 }, activePool, 0.2);
  assert.equal(low, "glimmer");
  assert.equal(high, "moon");
}

function testHistorySummary() {
  const state = createInitialGachaState();
  state.totalPulls = 9;
  const result = drawBatch({ count: 1, state, pool: activePool, characters, rng: rngFrom([0.99, 0.01, 0.1]) });
  const summary = summarizeHistoryEntry(result.results[0], result.nextState, "2026-04-30T12:00:00.000Z");
  assert.equal(summary.pullNumber, 10);
  assert.equal(summary.timestamp, "2026-04-30T12:00:00.000Z");
  assert.ok(summary.rarityLabel.includes("★"));
}

function testDrawResultsAreNotMarkedNewByDefault() {
  const state = createInitialGachaState();
  const result = drawBatch({ count: 1, state, pool: activePool, characters, rng: rngFrom([0.99, 0.1]) });
  assert.equal(result.results[0].isNew, false);
}

function testHistorySummaryUsesResultPityForMultiPulls() {
  const state = createInitialGachaState();
  const result = drawBatch({ count: 2, state, pool: activePool, characters, rng: rngFrom([0.99, 0.1]) });
  const firstSummary = summarizeHistoryEntry(result.results[0], result.nextState, "2026-04-30T12:00:00.000Z");
  const secondSummary = summarizeHistoryEntry(result.results[1], result.nextState, "2026-04-30T12:01:00.000Z");
  assert.equal(result.results[0].pityAfter.moonPity, 1);
  assert.equal(result.results[1].pityAfter.moonPity, 2);
  assert.equal(firstSummary.moonPityAfter, 1);
  assert.equal(secondSummary.moonPityAfter, 2);
  assert.equal(firstSummary.guaranteedRateUpAfter, false);
}

testCharacterCounts();
testCharacterRosterIsAllFemale();
testCharacterNameStyleRatio();
testCharacterImagesExist();
testCharacterStoriesArePresent();
testHardPityForcesMoon();
testTenPullGuaranteePromotesStar();
testStarPityForcesStarOnSinglePull();
testRateUpGuaranteeAfterLosingFiftyFifty();
testSoftPityIncreasesMoonRate();
testHistorySummary();
testDrawResultsAreNotMarkedNewByDefault();
testHistorySummaryUsesResultPityForMultiPulls();
console.log("gacha-engine tests passed");
