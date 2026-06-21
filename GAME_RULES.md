# NG Whot — Official Game Rules & Configurations

NG Whot supports both classic Nigerian Whot rules and modern customizations inspired by chess.com match settings.

---

## 1. Card Layout

A standard Whot deck has 5 suits:
- ⭕ **Circles** (1-14)
- 🔺 **Triangles** (1-14)
- ✚ **Crosses** (1-14)
- 🟦 **Squares** (1-14)
- ⭐ **Stars** (1-14, counts double value for scoring)
- 🎴 **Whot 20** (Wildcards)

---

## 2. Configurable Rules

Before starting any match, host players can configure the following rules:

### A. Wildcard Toggle (Whot 20)
- **Enabled (Default)**: Five Whot 20 wildcards are shuffled into the deck. When played, the player calls a new suit.
- **Disabled**: All Whot 20 cards are removed. The game relies entirely on standard matching.

### B. Suspension & Hold On Options
- **Option A (Default)**: Card 1 is **Hold On** (next player skips their turn) and Card 8 is **Suspension** (active player gets another turn).
- **Option B**: Card 8 is **Hold On** and Card 1 is **Suspension**.

### C. Game Timeout & Checkups
- If a player's chess clock runs down to `0:00`, they are automatically eliminated!
- If the draw deck runs out or a player declares **Checkup**, all players count the sum value of cards remaining in their hands:
  - Whot 20 = 20 points
  - Stars = double their printed face value
  - All other suits = printed face value
- The player with the **lowest** sum value is declared the winner. The player with the **highest** sum value is out.

---

## 3. Special Cards Actions

| Card | Action Name | Description |
|------|-------------|-------------|
| **1 (or 8)** | Hold On / Suspension | The next player's turn is skipped, or the active player gets an extra turn (configurable). |
| **2** | Pick Two | The next player must instantly draw 2 cards from the deck, unless they play another Card 2 to stack the penalty. |
| **5** | Pick Three | The next player must draw 3 cards from the deck, unless they stack another Card 5. |
| **14** | General Market | Every player except the one who played Card 14 must draw 1 card from the deck. |
| **20** | Whot Wildcard | Can be played on any card. The active player calls a new suit (e.g. "Crosses") which the next player must follow. |
