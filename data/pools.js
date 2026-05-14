(function initPools(root, factory) {
  const pools = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = pools;
  } else {
    root.MoonwhitePools = pools;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function createPools() {
  return {
    activePoolId: "moonwhite-echoes-001",
    pools: [
      {
        id: "moonwhite-echoes-001",
        name: "月白回响",
        subtitle: "限定月辉回响",
        rateUpCharacterId: "lunara",
        heroCopy: "云镜开启时，月光会记住每一次相遇。",
        actionSingle: "回响一次",
        actionTen: "回响十次",
        rarityLabels: {
          moon: "月辉 ★★★★★",
          star: "星辉 ★★★★",
          glimmer: "微光 ★★★"
        },
        rates: {
          moon: 0.016,
          star: 0.1,
          glimmer: 0.884
        },
        pity: {
          hardMoon: 80,
          softMoonStart: 65,
          softMoonStep: 0.055,
          rateUpChance: 0.5,
          tenPullGuarantee: "star"
        }
      }
    ]
  };
});
