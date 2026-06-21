// Unit Tests for NG Whot Engine

// Mock window object for engine compatibility
global.window = {};

require('./engine.js');
const WhotEngine = global.window.WhotEngine;

console.log("=== STARTING NG WHOT ENGINE TESTS ===");

// 1. Verify Deck Size and Suit Counts
const deck = WhotEngine.createDeck();
console.log(`Deck size: ${deck.length} (Expected: 54)`);
if (deck.length !== 54) throw new Error("Incorrect deck size!");

const counts = { circle: 0, triangle: 0, cross: 0, square: 0, star: 0, whot: 0 };
deck.forEach(c => counts[c.suit]++);

console.log("Suit distribution:", counts);
if (counts.circle !== 12) throw new Error("Circle count should be 12");
if (counts.triangle !== 12) throw new Error("Triangle count should be 12");
if (counts.cross !== 9) throw new Error("Cross count should be 9");
if (counts.square !== 9) throw new Error("Square count should be 9");
if (counts.star !== 7) throw new Error("Star count should be 7");
if (counts.whot !== 5) throw new Error("WHOT wildcard count should be 5");

console.log("✓ Deck Composition is perfect (54 cards total).");

// 2. Test Game Setup
let state = WhotEngine.createGame(3, { allowDefend: true, holdOnCard: 1 });
console.log(`Players created: ${state.players.length} (Expected: 3)`);
console.log(`Player 1 hand size: ${state.players[0].hand.length} (Expected: 5 for 3p)`);
console.log(`Current player: ${state.currentPlayer} (Expected: 0)`);

// 3. Test Hold On (Card 1)
// Force player 0 to have card 1
state.players[0].hand[0] = { suit: 'circle', num: 1, id: 'test-1' };
state.pile = [{ suit: 'circle', num: 10, id: 'top-10' }]; // normal non-special matching card
state = WhotEngine.playCard(state, 0, 'test-1');
console.log(`Played Hold On (Card 1). Next player should be same player (0). Current player: ${state.currentPlayer}`);
if (state.currentPlayer !== 0) throw new Error("Hold On should let the same player play again!");

// 4. Test Suspension (Card 8)
state.currentPlayer = 0;
state.players[0].hand[0] = { suit: 'circle', num: 8, id: 'test-8' };
state.pile = [{ suit: 'circle', num: 1, id: 'top-1' }];
state = WhotEngine.playCard(state, 0, 'test-8');
console.log(`Played Suspension (Card 8). Next player should skip player 1 and go to player 2. Current player: ${state.currentPlayer}`);
if (state.currentPlayer !== 2) throw new Error("Suspension should skip the next player (0 -> 2)!");

// 5. Test General Market (Card 14)
state.currentPlayer = 0;
const p0InitialHandSize = state.players[0].hand.length;
const p1InitialHandSize = state.players[1].hand.length;
const p2InitialHandSize = state.players[2].hand.length;

state.players[0].hand[0] = { suit: 'circle', num: 14, id: 'test-14' };
state.pile = [{ suit: 'circle', num: 8, id: 'top-8' }];
state = WhotEngine.playCard(state, 0, 'test-14');

console.log(`Played General Market (Card 14).`);
console.log(`Player 0 hand size change: ${state.players[0].hand.length - p0InitialHandSize} (Expected: 0 net change: -1 played, +1 drawn)`);
console.log(`Player 1 hand size change: ${state.players[1].hand.length - p1InitialHandSize} (Expected: +1 drawn)`);
console.log(`Player 2 hand size change: ${state.players[2].hand.length - p2InitialHandSize} (Expected: +1 drawn)`);
console.log(`Current player: ${state.currentPlayer} (Expected: 0 since player plays again)`);

if (state.players[1].hand.length !== p1InitialHandSize + 1) throw new Error("Player 1 should have drawn 1 card from general market");
if (state.players[2].hand.length !== p2InitialHandSize + 1) throw new Error("Player 2 should have drawn 1 card from general market");
if (state.currentPlayer !== 0) throw new Error("Current player should remain 0 after General Market");

// 6. Test Pick 2 and Defend Stacking
state.currentPlayer = 0;
state.players[0].hand[0] = { suit: 'circle', num: 2, id: 'test-pick2-a' };
state.pile = [{ suit: 'circle', num: 14, id: 'top-14' }];
state = WhotEngine.playCard(state, 0, 'test-pick2-a');
console.log(`Played Pick 2. Pending pickups: ${state.pendingPickup} (Expected: 2)`);
if (state.pendingPickup !== 2) throw new Error("Pending pickups should be 2");

// Player 1 defends with another 2
state.currentPlayer = 1;
state.players[1].hand[0] = { suit: 'triangle', num: 2, id: 'test-pick2-b' };
state = WhotEngine.playCard(state, 1, 'test-pick2-b');
console.log(`Player 1 defended with Pick 2. Pending pickups: ${state.pendingPickup} (Expected: 4)`);
if (state.pendingPickup !== 4) throw new Error("Pending pickups should be 4");

// Player 2 draws the 4 cards
state.currentPlayer = 2;
const p2HandBeforeDraw = state.players[2].hand.length;
state = WhotEngine.drawCard(state, 2);
console.log(`Player 2 drew pending cards. Hand size change: ${state.players[2].hand.length - p2HandBeforeDraw} (Expected: 4)`);
console.log(`Pending pickups after draw: ${state.pendingPickup} (Expected: 0)`);
if (state.players[2].hand.length !== p2HandBeforeDraw + 4) throw new Error("Player 2 should draw exactly 4 cards");
if (state.pendingPickup !== 0) throw new Error("Pending pickups should reset to 0");

// 7. Checkup Elimination Flow
state.eliminated = [];
state.players[0].hand = [{ suit: 'circle', num: 3, id: 'p0-c1' }]; // score 3
state.players[1].hand = [{ suit: 'circle', num: 10, id: 'p1-c1' }, { suit: 'star', num: 5, id: 'p1-c2' }]; // score 10 + 5*2 = 20
state.players[2].hand = [{ suit: 'cross', num: 11, id: 'p2-c1' }]; // score 11

const result = WhotEngine.doCheckupElimination(state);
console.log("Checkup elimination result:", result);
if (result.eliminatedNow[0] !== 1) throw new Error("Player 1 should be eliminated (highest score: 20)");

// 8. Test Pick 2 and Defend Blocking
let blockState = WhotEngine.createGame(3, { allowDefend: true, defenseMode: 'block', holdOnCard: 1 });
blockState.currentPlayer = 0;
blockState.players[0].hand[0] = { suit: 'circle', num: 2, id: 'test-block2-a' };
blockState.pile = [{ suit: 'circle', num: 14, id: 'top-14' }];
blockState = WhotEngine.playCard(blockState, 0, 'test-block2-a');
console.log(`Played Pick 2 (Block Mode). Pending pickups: ${blockState.pendingPickup} (Expected: 2)`);
if (blockState.pendingPickup !== 2) throw new Error("Pending pickups should start at 2");

// Player 1 defends with another 2
blockState.currentPlayer = 1;
blockState.players[1].hand[0] = { suit: 'triangle', num: 2, id: 'test-block2-b' };
blockState = WhotEngine.playCard(blockState, 1, 'test-block2-b');
console.log(`Player 1 defended with Pick 2 (Block Mode). Pending pickups: ${blockState.pendingPickup} (Expected: 0)`);
if (blockState.pendingPickup !== 0) throw new Error("Pending pickups should reset to 0 in Block Mode");

console.log("✓ All Engine tests passed successfully!");
