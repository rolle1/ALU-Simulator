# 4-Bit Binary Adder — Visual ALU Simulator

An interactive visualization of how CPUs perform addition at the hardware level, built with React.

**Two architectures side by side:**

- **Ripple Carry Adder** — The simple approach: each bit waits for the previous carry. 16 sequential gate operations for 4 bits.
- **Carry-Lookahead Adder** — The real-world approach: all carries computed simultaneously using Generate/Propagate logic. Just 3 steps regardless of bit width.

**Features:**

- Animated signal flow through logic gates (XOR, AND, OR)
- Play / Pause / Step controls with adjustable speed
- Live step-by-step explanations of every gate operation
- Seven-segment display output
- Truth tables and educational breakdowns
- Architecture comparison showing why lookahead scales

## Run Locally

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

This repo includes a GitHub Actions workflow that auto-deploys on push to `main`.

1. Push this repo to GitHub
2. Go to **Settings → Pages → Source** → select **GitHub Actions**
3. Push to `main` — it builds and deploys automatically

Your site will be live at `https://<username>.github.io/alu-simulator/`

> If you rename the repo, update the `base` path in `vite.config.js` to match.

## Tech

React 18 + Vite. No external UI libraries — all SVG circuit rendering is hand-built.
