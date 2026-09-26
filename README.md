# CubeClash

**CubeClash** is a mobile-friendly speedcubing timer designed primarily for training on 2×2 and 3×3 cubes. Built with offline support, 3D scramble visualization, and live 1v1 challenges, it keeps your data secure by saving all your times directly to your device. 

For casual solving, CubeClash generates browser scrambles using a built-in 3D solver that constructs the cube locally without relying on any CDN. *(Note: Official WCA competitions must use official WCA software).*

---

## 🚀 Key Features

*   **Offline First:** Solves and statistics are stored locally on your phone.
*   **3D Scramble Visualization:** Generates cube states entirely in the browser with no CDN required.
*   **Live 1v1 Challenges:** Race against friends in real-time with peer-to-peer video streaming.
*   **Progressive Web App (PWA):** Install it directly to your home screen for a native app feel.

---

## 📲 Installation

CubeClash can be installed directly onto your device's home screen:

*   **Android / Desktop:** Click the installation prompt in your browser address bar.
*   **iOS Users:** Open the app in **Safari**, tap the **Share** button, and select **"Add to Home Screen"**.

### Offline Deployment
You can host and use CubeClash offline by deploying it to **GitHub Pages**. Note that certain features (like camera access and PWA installation) require an **HTTPS** connection to function.

---

## ⚔️ How to Play: 1v1 Challenges

1.  **Host a Match:** One player clicks the **CREATE ROOM** button to generate a unique room code.
2.  **Join the Match:** The second player enters the code and clicks **JOIN ROOM**.
3.  **The Interface:** The app opens a clean game window dedicated to videos, scrambles, and stats, while the main tab handles the background logic.
4.  **Video Streaming:** Allow the browser permission to access your camera to enable the peer-to-peer video stream.

---

## 🛠️ Troubleshooting & Resetting

If you encounter bugs after an application update, you can safely reset your application state:

1. Navigate to **Settings** → **Export + Wipe App Data**.
2. **Download** your solve history in JSON format.
3. Clear your browser cache and reinstall the application.
