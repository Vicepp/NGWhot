# NG Whot — Online Card Game Platform

Welcome to **NG Whot**, a premium mobile-first Whot card game platform designed for the African market. It includes online matchmaking, custom chess-style timers, tribal community rooms, player rankings, wallet wagers, offline Bluetooth/WiFi play, and a platform owner's Admin Portal.

---

## Folder Structure

This repository contains two primary client applications:

1. **Player App (`player-app/`)**: The main client interface where players register, customize matches, view profiles, climb the leaderboards, fund wallets, chat in tribe rooms, and play games.
2. **Admin Portal (`admin-portal/`)**: The platform operator's control center to manage active games, audit player profiles, check KYC verification, approve cashouts/withdrawals, and configure transaction commissions.

---

## Quick Start (How to Run the Demo)

You can launch and test both applications directly in Google Chrome without installing any external server tools or dependencies.

### Step 1: Open Player App
Navigate to the `player-app/` folder and open the `index.html` file in Google Chrome.
- *Alternatively, run a static server in the directory if needed (e.g. `npx serve` or double-click `index.html` directly).*

### Step 2: Open Admin Portal
Navigate to the `admin-portal/` folder and open the `index.html` file in Google Chrome to inspect the operator dashboard side-by-side.

---

## Core Demo Walkthrough Flow

To experience all the requirements implemented in the codebase:

1. **Create Account & Login**:
   - Open the **Player App**.
   - Click **Sign Up** or **Play Free Practice**. Choose a nickname (e.g. `Chukwu`) and pick your home tribe (e.g. `Igbo`).

2. **Check Game Lobby & Configuration (Chess.com-style)**:
   - Navigate to the **Game Lobby**.
   - Note the chess-style timer choices: Bullet (1m), Blitz (3m), Rapid (10m), Classical (30m), or Unlimited.
   - Configure custom mechanics: Turn the wildcard **Whot 20** on or off. Toggle the **Hold On / Suspension** card to be Card 1 or Card 8. Set optional entry fee **Wagers** (e.g. ₦1,000).
   - Click **Play Game** and read the **Pre-Match Rules & Mechanics** screen. Click **I Agree, Join Match** to start.

3. **Play the Whot Game**:
   - The game board launches. Check out the clean, glowing African-themed cards.
   - Pick your card and click **Play Selected Card**.
   - If you play a **Whot 20** wildcard, the suit selection popover will trigger.
   - Note the active player turn indicators and the chess turn timer counting down. If time runs out, the player with the highest card score sum is eliminated!
   - You can also click **Check / Declare Win** to trigger checkup card score sum calculations instantly.
   - Send trash talk messages in the bottom-right in-game chat panel and watch opponents reply in real-time.

4. **Climb Tribe Wars & Competitions**:
   - Navigate to the **Competitions** page to check out tribal chatrooms (Igbo, Yoruba, Hausa, Efik).
   - View public/private matches created by other players. Try creating your own funded private matches using the **Create Private Match** button.
   - Check the **Rankings** leaderboard page showing daily, weekly, and monthly standings.

5. **Wallet Funding & P2P Offline UI**:
   - Go to the **Wallet** page. Try funding your balance or withdrawing cash (note the 1.5% transactional fee shown).
   - Go to the **Offline Play** page to see the local Bluetooth and WiFi Hotspot pairing setup panels.

6. **Manage as Administrator**:
   - Open the **Admin Portal**.
   - Review active platform wagers, platform fee earnings, ban/unban players, verify KYC, approve pending cashout withdrawals, and modify withdrawal fee percentages.
