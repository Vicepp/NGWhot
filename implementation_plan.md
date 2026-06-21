# Game Board Interactivity & Layout Enhancements

Based on your feedback, here is the plan to reintroduce the chat pane, modernize the mobile layout, implement direct tap-to-play, and add realistic card flight animations for opponents.

## 1. Chat Pane Restoration
We will modify the new full-screen game board layout to accommodate the chat pane without sacrificing the immersive "felt" table aesthetic.
- **Desktop**: The board will be split into a main play area (left) and a sleek, translucent chat pane (right).
- **Mobile**: The chat pane will be hidden by default. A new 💬 Chat button will be added to the top navigation bar. Tapping it will slide the chat pane in over the game board.

## 2. One-Tap Play & Button Removal
- The **"Play Card"** and **"Check Up"** buttons beneath the player's hand will be completely removed.
- **Tapping a card** in your hand will instantly validate and play it. If it’s a Whot 20 card, it will instantly pop up the suit selection modal before playing.
- The **Check Up** action will be moved into the ☰ Settings Menu so the feature isn't lost but doesn't clutter the main UI.

## 3. Opponent Animations (Flight & Flip)
When a CPU opponent (or remote player) plays a card, it won't just magically appear in the center anymore.
- A card will physically detach from their fanned stack.
- It will **fly across the board** to the center pile.
- As it flies, it will perform a **3D flip** to reveal the card face before landing.

## 4. Accurate Card Counting
- The fanned card stack next to each opponent's avatar will dynamically shrink in real-time. If an opponent drops below 4 cards, the physical stack on the table will reflect exactly how many cards they hold.
- The numeric card-count badge on their avatar will continue to update simultaneously with the visual stack.

---

### Files to Modify

#### [MODIFY] `player-app/game.css`
- Add structural layout classes (`.gb-layout`, `.gb-main`, `.gb-sidebar`)
- Add mobile overlay classes for the chat (`.gb-sidebar.mobile-open`)
- Add animation keyframes for card flight (`@keyframes flightPath`)
- Add chat UI styling (input, message bubbles) matching the dark green aesthetic.

#### [MODIFY] `player-app/game_board.js`
- **`_boardHTML()`**: Wrap the current elements in the new layout structure, inject the chat HTML block, and add the Chat toggle button to the top bar.
- **`onPlayCard()`**: Refactor to accept a `cardId` directly from the `onclick` handler, eliminating the need for `selectCard`.
- **`_executePlay()`**: Add the flight animation logic for opponents. We will calculate the DOM coordinates of the opponent's stack and the center pile, generate a temporary flying card, animate it, and clean it up when it lands.
- **Chat Logic**: Re-implement `sendGameChatMessage()` locally within `GameBoard` to handle user messages and mock CPU replies.

### Verification Plan
1. Open the game in Desktop view: Verify the chat pane sits neatly on the right.
2. Shrink window to Mobile view: Verify the chat pane hides and the 💬 icon appears. Toggle it to ensure it overlays correctly.
3. Tap a valid card in hand: Verify it plays immediately without needing to press a "Play Card" button.
4. Watch a CPU turn: Verify their card flies from their stack, flips, and lands in the center, while their fanned stack reduces visually.
