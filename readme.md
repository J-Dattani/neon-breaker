# ⚡ NEON BREAKER — Gesture-Controlled Neon Game

**NEON BREAKER** is a real-time, camera-based gesture game built entirely for the web.  
Players slice neon shapes using **hand gestures**, without mouse, keyboard, or touch — delivering an **AR-like experience directly in the browser**.

---

## 🚀 Play Now (Live)

🎮 **Live Demo (Sample):**  
👉 [https://neon-breaker.vercel.app](https://neon-breaker-one.vercel.app/)

> ⚠️ Requires camera access  
> 🖥 Best experienced on desktop Chrome / Edge  
> 💡 Use good lighting for accurate hand tracking  

---

## 🎮 Gameplay Overview

- ✋ **Open Palm** → Enter Ready Mode  
- ✊ **Hold Fist (1.5s)** → Start Game  
- ☝️ **Point Finger** → Slice neon shapes  
- 🔴 **Danger Objects** → Strikes & penalties  
- ❌ **Miss Shapes** → Strike added  
- 💥 **3 Strikes** → Game Over  

All interactions are **gesture-only**.  
No mouse. No keyboard. No touch.

---

## ✨ Key Features

- 🖐️ Real-time hand tracking using browser camera  
- 🟦 Neon-styled dynamic shapes (ORB, SHARD, BLOCK, DANGER)  
- 🎯 Difficulty scaling based on score  
- ⚠️ Strike & miss logic with visual feedback  
- 🌈 Screen-edge flash based on slice color  
- 📢 Floating warning text on penalties  
- 🔊 Background idle music + start sound  
- 🧠 Instruction overlay with gesture-hold confirmation  
- ⚡ Optimized for low latency & smooth gameplay  

---

## 🧩 Tech Stack

### 🖥 Frontend
- HTML5  
- CSS3 (Neon UI, animations)  
- Vanilla JavaScript (ES6+)

### 🧠 Computer Vision
- MediaPipe Hands  
- WebRTC Camera API  
- HTML5 Canvas API

### 🎵 Audio
- HTML5 Audio API  
- `bg_idle.mp3` — looped ambient background  
- `start.mp3` — game start sound  

### 🚀 Deployment
- GitHub  
- Vercel  

---

## 🔁 Game Flow

1. User opens the site  
2. Camera permission requested  
3. Instruction overlay appears (game locked)  
4. User holds finger on **OK** button (2s)  
5. Instructions close  
6. ✋ Open palm → Ready state  
7. ✊ Hold fist → Game starts  
8. ☝️ Slice shapes → Score increases  
9. ❌ Miss / 🔴 Danger → Strikes  
10. 💥 3 strikes → Game Over popup  

---

## 🛠 Run Locally

```bash
git clone https://github.com/your-username/neon-breaker.git
cd neon-breaker
Then open index.html using Live Server or any local HTTP server
(camera access requires http:// or https://).

⚠️ Notes & Best Experience
Camera input is mirrored (natural webcam behavior)

Works best in good lighting conditions

Minimal background clutter improves hand detection

Optimized for desktop & modern laptops

🏁 Status
✅ Ready to ship
🚀 Built, tested, and prepared for deployment
🔥 Gesture-only gameplay — no physical controls

Made with ❤️, caffeine, and neon vibes.
