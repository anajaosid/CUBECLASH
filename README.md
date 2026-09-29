# CubeClash

CubeClash is a lightweight browser-based speedcubing app built for quick solo practice and friendly online races. It gives you a clean 2×2 or 3×3 timer, internal scramble generation, local solve history, and a simple 1v1 room mode for challenging a friend.

## Why people use it

- Practice with a fast solo timer for 2×2 and 3×3 cubes
- Review recent solves and track averages without leaving the page
- Use a visual scramble cube while you learn and inspect your next move
- Jump into a quick local multiplayer match with a room code
- Keep everything on-device with IndexedDB storage and optional data export

## Features

- Solo timer with inspection and +2/DNF controls
- Local solve stats and recent-solve list
- 3D scramble visualization with replay support
- Dark and light theme options
- 1v1 room play with live timer updates
- Camera and microphone support for live chat and peer connection quality
- Installable PWA support on supported browsers
- JSON export/import for backing up or moving solve data

## Run it locally

CubeClash is a static web app, so it can run from a simple local file or be hosted on GitHub Pages or any static host.

For the full experience with camera, microphone, PWA support, and WebRTC, use an HTTPS site such as GitHub Pages.

## Quick start

1. Open the project in a browser.
2. Choose Solo Timer or Create / Join 1v1.
3. Start solving, review your stats, and manage your saved solves as needed.

## Project history

### v52
- Fixed the missing solo cube component that prevented the Solo Timer view from rendering.
- Restored scramble visualization, replay controls, move labels, and scramble-speed tools.
- Refreshed the service worker cache so the repaired solo screen loads correctly.

### v49
- Fixed cube-turn logic that could mutate cubies more than once in a move.
- Corrected standard F/B turn directions while preserving the usual R/L/U/D convention.
- Improved move validation and cube-state audit checks.
- Kept 2D and 3D scramble views consistent with the same engine state.

### v41
- Prevented Space/Enter from scrolling the solo page during timer use.
- Added delete buttons beside recent solo solves.
- Updated the storage flow so deleting a solve removes it from IndexedDB and refreshes the session history.

## Creator

Made with care by **Sid Anajao**.
