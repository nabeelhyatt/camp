<p align="center">
  <img src="app-icon.png" alt="Camp icon" width="128" />
</p>

<h1 align="center"><a href="https://getcamp.ai">Camp</a></h1>

<p align="center">Multiplayer AI workspace for group projects. Fork of <a href="https://chorus.sh">Chorus</a>.</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/771262eb-5a0e-40cb-b1a5-9df6b903c626" alt="Camp screenshot" />
</p>

# Getting Started

You will need:

1. NodeJS installed and on your path
2. Rust and Cargo installed and on your path (verify with `rustc --version`, `cargo --version`)
3. `imagemagick` (optional)
4. `git-lfs` (`brew install git-lfs`)
5. A package manager:
    - **For local development**: `pnpm` (`brew install pnpm`) - recommended for faster installs
    - **For Conductor**: Uses `npm` (comes with Node.js) automatically

Once you have those set up, please run:

```bash
git lfs install --force
git lfs pull

# Local development (recommended):
pnpm run setup
pnpm run dev

# OR using npm (Conductor uses this):
npm run setup
npm run dev
```

Vite will run on a random even-numbered port between 1422 and 1522, inclusive. HMR will run on the next port. If there's a collision, change the instance name (makes sure to rerun the setup script).

# Upstream Sync

Camp is a fork of [Chorus](https://github.com/meltylabs/chorus). See [UPSTREAM-SYNC.md](UPSTREAM-SYNC.md) for our policy on cherry-picking upstream fixes.
