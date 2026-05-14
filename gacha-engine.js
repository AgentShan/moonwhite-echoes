(function initGachaEngine(root, factory) {
  const engine = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = engine;
  } else {
    root.MoonwhiteGachaEngine = engine;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function createGachaEngine() {
  const DEFAULT_STATE = {
    version: 1,
    totalPulls: 0,
    moonPity: 0,
    starPity: 0,
    guaranteedRateUp: false,
    lastMoonAt: 0
  };

  function createInitialGachaState() {
    return { ...DEFAULT_STATE };
  }

  function getActivePool(poolConfig) {
    return poolConfig.pools.find((pool) => pool.id === poolConfig.activePoolId) || poolConfig.pools[0];
  }

  function getCharactersByRarity(characters, rarity) {
    return characters.filter((character) => character.rarity === rarity);
  }

  function getMoonRate(state, pool) {
    const base = pool.rates.moon;
    const pullsSinceMoon = state.moonPity + 1;
    if (pullsSinceMoon < pool.pity.softMoonStart) return base;
    const softSteps = pullsSinceMoon - pool.pity.softMoonStart + 1;
    return Math.min(1, base + softSteps * pool.pity.softMoonStep);
  }

  function selectRarity(state, pool, roll) {
    if (state.moonPity >= pool.pity.hardMoon - 1) return "moon";

    const moonRate = getMoonRate(state, pool);
    if (roll < moonRate) return "moon";
    if (state.starPity >= 9) return "star";
    if (roll < moonRate + pool.rates.star) return "star";
    return "glimmer";
  }

  function pickByRoll(items, roll) {
    if (items.length === 0) return null;
    const index = Math.min(items.length - 1, Math.floor(roll * items.length));
    return items[index];
  }

  function pickCharacter(rarity, pool, characters, state, rng) {
    if (rarity !== "moon") {
      return pickByRoll(getCharactersByRarity(characters, rarity), rng());
    }

    const rateUpCharacter = characters.find((character) => character.id === pool.rateUpCharacterId);
    if (state.guaranteedRateUp) {
      return rateUpCharacter || pickByRoll(getCharactersByRarity(characters, rarity), rng());
    }

    if (rateUpCharacter && rng() < pool.pity.rateUpChance) {
      return rateUpCharacter;
    }

    const standardMoonCharacters = getCharactersByRarity(characters, rarity).filter(
      (character) => character.id !== pool.rateUpCharacterId
    );
    return pickByRoll(standardMoonCharacters, rng()) || rateUpCharacter;
  }

  function applyPity(state, result) {
    state.totalPulls += 1;

    if (result.rarity === "moon") {
      state.moonPity = 0;
      state.starPity = 0;
      state.lastMoonAt = state.totalPulls;
      state.guaranteedRateUp = !result.isRateUp;
      return;
    }

    state.moonPity += 1;
    if (result.rarity === "star") {
      state.starPity = 0;
    } else {
      state.starPity += 1;
    }
  }

  function drawBatch({ count, state, pool, characters, rng }) {
    const nextState = { ...state };
    const results = [];

    for (let index = 0; index < count; index += 1) {
      const pityBefore = {
        moonPity: nextState.moonPity,
        starPity: nextState.starPity
      };
      let rarity = selectRarity(nextState, pool, rng());

      const isLastTenPull = count === 10 && index === count - 1;
      const hasStarOrMoon = results.some((item) => item.rarity === "star" || item.rarity === "moon");
      if (isLastTenPull && !hasStarOrMoon && rarity === "glimmer") {
        rarity = pool.pity.tenPullGuarantee;
      }

      const character = pickCharacter(rarity, pool, characters, nextState, rng);
      const result = {
        ...character,
        isNew: false,
        isRateUp: Boolean(character && character.id === pool.rateUpCharacterId),
        pullNumber: nextState.totalPulls + 1,
        pityBefore,
        pityAfter: null,
        guaranteedRateUpAfter: nextState.guaranteedRateUp
      };

      applyPity(nextState, result);
      result.pityAfter = {
        moonPity: nextState.moonPity,
        starPity: nextState.starPity
      };
      result.guaranteedRateUpAfter = nextState.guaranteedRateUp;
      results.push(result);
    }

    return { results, nextState };
  }

  function summarizeHistoryEntry(result, state, timestamp) {
    return {
      id: result.id,
      name: result.name,
      rarity: result.rarity,
      rarityLabel: result.rarityLabel,
      isRateUp: result.isRateUp,
      pullNumber: result.pullNumber,
      moonPityAfter: result.pityAfter ? result.pityAfter.moonPity : state.moonPity,
      guaranteedRateUpAfter:
        typeof result.guaranteedRateUpAfter === "boolean" ? result.guaranteedRateUpAfter : state.guaranteedRateUp,
      timestamp
    };
  }

  return {
    createInitialGachaState,
    drawBatch,
    getActivePool,
    getCharactersByRarity,
    selectRarity,
    summarizeHistoryEntry
  };
});
