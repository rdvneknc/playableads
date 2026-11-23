// Bloop Grove — Ad 01: one short match-3 level. Free the sleeping baby Bloops from their cocoons
// and clear the honey; whatever moves are left turn into bees, the grove blooms, end card.

export const AD = {
  // TODO: Bloop Grove store links (store-links.json is still empty)
  storeUrl: 'https://play.google.com/store/apps/details?id=com.example.bloopgrove',
  iosStoreUrl: 'https://apps.apple.com/app/id0000000000',
};

export const TEXT = {
  moves: 'MOVES',
  cta: 'PLAY NOW',
  intro: 'Wake up the baby Bloops!',
  free: 'Free!',
  shuffle: 'Shuffle!',
  lastMoves: '3 moves left!',
  bonus: 'Bloop Bonus!',
  combos: ['Sweet!', 'Great!', 'Amazing!', 'Bloop-tastic!'],
  winTitle: 'Grove awake!',
  winSub: 'Help the Bloops bring every forest back to life.',
  loseTitle: 'So close!',
  loseSub: 'The baby Bloops are waiting for you.',
};

export const LEVEL = {
  moves: 20,
  // cocoons (row, col); row 0 is the far edge
  cocoons: [
    [2, 1],
    [1, 4],
    [2, 6],
  ],
  // honey cells: value = layers
  honey: {
    '5,2': 1, '5,3': 2, '5,4': 2, '5,5': 1,
    '6,3': 1, '6,4': 1,
  },
  hintAfter: 4.5,
};
