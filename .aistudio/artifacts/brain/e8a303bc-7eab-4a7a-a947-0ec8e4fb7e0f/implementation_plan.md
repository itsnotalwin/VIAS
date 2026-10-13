# GitHub Push & Deployment Resolution Plan

Resolve the "Failed to push commit to GitHub: Request contains an invalid argument" error when using AI Studio's built-in GitHub exporter, ensuring seamless sync to a brand new repository and zero-friction GitHub Pages deployment.

### User Review & Critical Decisions

> [!IMPORTANT]
> The error `Failed to push commit to GitHub: Request contains an invalid argument` occurs when AI Studio's export payload exceeds GitHub API tree limits or when modal inputs (Repository Name, Owner, or Branch) do not conform to GitHub's expected schema.

- **Confirmed Decision 1**: We will prune unnecessary bloat files (`bun.lock` at 122KB, `dist/server.cjs.map` source maps, and pre-built distribution cache) from the workspace so the GitHub API payload stays well below API argument limits.
- **Confirmed Decision 2**: Target repository is a brand new empty repository without a default README/license to prevent branch history divergence.
- **Confirmed Decision 3**: We will verify `.gitignore` rules and provide exact guidance on how to populate the AI Studio GitHub push dialog (format of repository name, branch, and commit message).

---

### 1. Overview & Core Concept

- **Problem**: When triggering the "Push to GitHub" / "Export to GitHub" feature in AI Studio, the backend builds a Git tree and payload sent to GitHub's REST/GraphQL API. Large non-source files (`bun.lock`, `package-lock.json`, `dist/server.cjs.map`) or malformed input parameters in the UI cause GitHub API validation to reject the request with `Request contains an invalid argument`.
- **Target Outcome**: The project cleanly commits and pushes to the user's GitHub repository in one click, and GitHub Actions automatically builds and publishes the live site to GitHub Pages.

---

### 2. Resolution Strategy & Workflow

```
┌─────────────────────────────────────────────────────────┐
│              Workspace Payload Optimization              │
│                                                         │
│  1. Remove bun.lock (122KB binary duplicate)           │
│  2. Clean dist/ bundle & sourcemaps (server.cjs.map)    │
│  3. Streamline .gitignore so dist/ & logs stay ignored  │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│               Push to GitHub Modal Check                │
│                                                         │
│  • Repository Name: simple-name (no spaces/slashes)     │
│  • Target Branch: main                                  │
│  • Commit Message: Initial commit                       │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│               GitHub Pages Automated Build              │
│                                                         │
│  • .github/workflows/deploy.yml triggers on main push   │
│  • Runs vite build & copies 404.html                    │
│  • Deploys live site with relative paths & .nojekyll    │
└─────────────────────────────────────────────────────────┘
```

#### Step 1: Optimize Workspace Payloads
- Safely remove `bun.lock` (an unneeded duplicate lockfile consuming 122KB; `package.json` and standard npm are the source of truth).
- Clean `dist/` before export so generated sourcemaps and massive compiled bundles aren't packed into the API tree request (GitHub Actions workflow will build fresh assets during deploy).
- Ensure `.gitignore` explicitly prevents temporary files, cache, and sourcemaps from entering Git.

#### Step 2: Validate AI Studio Export Parameters
- Detail the exact formatting requirements for the AI Studio Push modal:
  1. **Repository**: Must be entered as either `repo-name` or `username/repo-name` without spaces, trailing slashes, or URL prefixes (`https://github.com/...`).
  2. **Branch**: Enter `main`.
  3. **Commit message**: Provide a concise message such as `Initial commit`.

#### Step 3: Verify Build & GitHub Pages Compatibility
- Verify that `npm run build` cleanly runs `vite build`, Node server bundling, and `scripts/copy-404.js`.
- Confirm `.github/workflows/deploy.yml` and `public/.nojekyll` are in place so GitHub Pages activates automatically upon push.

---

### 3. Product Decisions & Trade-Offs

- **Lockfile Strategy**: Remove `bun.lock` while keeping `package.json` intact. This reduces payload size by over 120KB and prevents package manager conflicts.
- **Distribution Directory (`dist`)**: Remove compiled artifacts prior to pushing. GitHub Pages uses GitHub Actions (`.github/workflows/deploy.yml`) to compile from source in the cloud, so committing `dist/` to the repository root is unnecessary and triggers GitHub payload size rejections.

---

### 4. Technical Architecture & Verification Plan

```
Workspace Files to Commit:
├── .github/workflows/deploy.yml   (Automated CI/CD deployment)
├── public/                        (Static assets, icons, manifest, .nojekyll)
├── src/                           (React + Tailwind application source)
├── scripts/copy-404.js            (SPA deep-linking helper for GitHub Pages)
├── server.ts                      (Backend API server)
├── index.html                     (Vite entrypoint with relative paths)
├── package.json                   (Dependencies and build scripts)
├── tsconfig.json                  (TypeScript configuration)
└── vite.config.ts                 (Configured with relative base: './')
```

#### Verification Steps:
1. Confirm workspace contains only clean, necessary source files.
2. Run `compile_applet` and `lint_applet` to guarantee complete build integrity.
3. Test a clean build locally to confirm zero build errors and proper creation of `dist/404.html`.
4. Provide immediate step-by-step guidance for pressing the Push to GitHub button.
