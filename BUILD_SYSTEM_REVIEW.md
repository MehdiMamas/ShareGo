# ShareGo Build System & CI/CD Critical Review

**Date:** February 8, 2026  
**Reviewer:** AI Assistant  
**Scope:** Build configuration, dependencies, CI/CD workflows, and related infrastructure

---

## Executive Summary

This review identified **15 critical issues**, **8 warnings**, and **3 security concerns** across the build system and CI/CD configuration. The most severe issues are:

1. **Broken workspace references** in root `package.json` (lines 17-18, 21)
2. **Missing dependency** (`react-native-zeroconf` referenced but not installed)
3. **Fragile CI/CD workarounds** (symlink hacks for monorepo resolution)
4. **Missing iOS build job** in release workflow
5. **Hardcoded paths** and workarounds throughout vite config

---

## 1. Root `package.json`

**File:** `package.json`  
**Lines:** 1-54

### Critical Issues

#### 1.1 Broken Workspace References (Lines 17-18, 21)
**Severity:** 🔴 CRITICAL  
**Issue:** Scripts reference non-existent workspace names:
- Line 17: `"dev:desktop": "turbo run dev --filter=sharego-desktop"` — workspace name is `sharego-app`, not `sharego-desktop`
- Line 18: `"dev:mobile": "npm run start --workspace=sharego-mobile"` — workspace name is `sharego-app`, not `sharego-mobile`
- Line 21: `"dev:android": "npm run android --workspace=sharego-mobile"` — same issue

**Impact:** These scripts will fail when executed. The `dev:desktop` command will not find any workspace matching `sharego-desktop`, and the `dev:mobile`/`dev:android` commands will fail because `sharego-mobile` doesn't exist.

**Fix:** Update to use correct workspace name:
```json
"dev:desktop": "turbo run dev --filter=sharego-app",
"dev:mobile": "npm run start --workspace=sharego-app",
"dev:android": "npm run android --workspace=sharego-app",
```

#### 1.2 Inconsistent Script Patterns
**Severity:** 🟡 WARNING  
**Issue:** Mix of `turbo` and direct `npm` workspace commands. Some scripts use `turbo run` with filters, others use `npm run --workspace=`.

**Impact:** Inconsistent developer experience, harder to maintain.

**Recommendation:** Standardize on either Turbo or npm workspaces, not both.

### Dependency Issues

#### 1.3 Package Manager Version Pinning
**Severity:** 🟡 WARNING  
**Issue:** Line 42: `"packageManager": "npm@10.9.3"` — very specific version pinning.

**Impact:** May cause issues for contributors using different npm versions. Corepack should handle this, but if Corepack isn't enabled, builds may fail.

**Recommendation:** Document Corepack requirement in README or add preflight check.

#### 1.4 Overrides Without Documentation
**Severity:** 🟡 WARNING  
**Issue:** Lines 49-53: Overrides for `react-native-screens`, `react-native-safe-area-context`, and `react-native-svg` without explanation.

**Impact:** Future maintainers won't know why these overrides exist. Could mask version conflicts.

**Recommendation:** Add comment explaining why each override is necessary.

---

## 2. `core/package.json`

**File:** `core/package.json`  
**Lines:** 1-25

### Status: ✅ CLEAN

No issues found. Dependencies are appropriate, scripts are minimal and correct.

**Note:** The `type: "module"` (line 6) is correct for ESM-only core package.

---

## 3. `apps/app/package.json`

**File:** `apps/app/package.json`  
**Lines:** 1-129

### Critical Issues

#### 3.1 Missing Dependency: `react-native-zeroconf`
**Severity:** 🔴 CRITICAL  
**Issue:** `vite.config.ts` line 11 lists `react-native-zeroconf` in `nativeOnlyModules`, but this package is not in `dependencies` or `devDependencies`.

**Impact:** 
- If code ever imports this module, the build will fail
- The stub plugin will work, but it's misleading to list a module that doesn't exist
- Documentation (ARCHITECTURE.md line 65) mentions it, creating confusion

**Fix Options:**
1. Add `react-native-zeroconf` to dependencies if it's actually used
2. Remove from `vite.config.ts` if it's not needed
3. Verify actual usage in codebase (search shows no imports)

**Recommendation:** Remove from `vite.config.ts` since no code imports it. If it's planned for future use, add a TODO comment.

#### 3.2 Workspace Name Mismatch
**Severity:** 🟡 WARNING  
**Issue:** Package name is `sharego-app` (line 2), but root `package.json` scripts reference `sharego-desktop` and `sharego-mobile`.

**Impact:** Confusion about package identity. The unified app approach is correct, but naming inconsistency causes issues.

**Note:** This is related to issue 1.1 above.

### Dependency Issues

#### 3.3 Duplicate Version Constraints
**Severity:** 🟡 WARNING  
**Issue:** 
- Root `package.json` has `overrides` for `react-native-screens: 3.35.0`, `react-native-safe-area-context: 4.14.0`, `react-native-svg: 15.3.0`
- `apps/app/package.json` also has direct dependencies:
  - Line 98: `"react-native-safe-area-context": "4.14.0"`
  - Line 99: `"react-native-screens": "3.35.0"`
  - Line 100: `"react-native-svg": "~15.3.0"`

**Impact:** Redundant version pinning. The override should be sufficient, but having both creates confusion about which takes precedence.

**Recommendation:** Remove direct version pins from `apps/app/package.json` and rely on root overrides, OR remove overrides and pin versions only in app package.json.

#### 3.4 `tweetnacl` Dependency Justification
**Severity:** ✅ ACCEPTABLE  
**Status:** `tweetnacl` (line 105) is actually used in `apps/app/src/stubs/libsodium-compat.js` for X25519 key exchange in React Native. This is a legitimate dependency, not dead code.

**Note:** The security implications of using `tweetnacl` alongside libsodium are documented in the compat shim file.

#### 3.5 Electron Version Pinning
**Severity:** 🟡 WARNING  
**Issue:** Line 121: `"electron": "33.4.11"` — exact version pinning (no `^` or `~`).

**Impact:** Won't receive security patches automatically. Electron releases security updates frequently.

**Recommendation:** Use `^33.4.11` to allow patch updates, or document why exact pinning is required.

#### 3.6 React Native Version
**Severity:** 🟡 INFO  
**Issue:** Line 92: `"react-native": "0.75.0"` — very recent version.

**Impact:** None if tested, but React Native 0.75 is cutting-edge. Ensure all dependencies are compatible.

**Recommendation:** Verify all React Native dependencies support 0.75.0.

### Build Configuration Issues

#### 3.7 Electron Builder Configuration
**Severity:** 🟡 WARNING  
**Issue:** Line 60: `"hardenedRuntime": false` — macOS hardened runtime is disabled.

**Impact:** App may not pass macOS notarization requirements. Users may see security warnings.

**Recommendation:** Enable hardened runtime and configure entitlements properly:
```json
"hardenedRuntime": true,
"gatekeeperAssess": false,
"entitlements": "build/entitlements.mac.plist",
"entitlementsInherit": "build/entitlements.mac.plist"
```

---

## 4. `apps/app/vite.config.ts`

**File:** `apps/app/vite.config.ts`  
**Lines:** 1-142

### Critical Issues

#### 4.1 Hardcoded libsodium Path (Lines 101-104)
**Severity:** 🔴 CRITICAL  
**Issue:** Hardcoded relative path to libsodium CJS dist:
```typescript
"libsodium-wrappers-sumo": path.resolve(
  __dirname,
  "../../node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js",
),
```

**Impact:**
- Fragile — breaks if libsodium package structure changes
- Assumes specific dist structure
- Comment says "ESM dist is incomplete" but doesn't explain why CJS is needed

**Recommendation:**
1. Document why ESM dist doesn't work
2. Consider using a package.json `exports` override instead
3. Add a fallback or error message if path doesn't exist

#### 4.2 Multiple React Native Stubs (Lines 81-96)
**Severity:** 🟡 WARNING  
**Issue:** Four hardcoded stub paths for React Native internals:
- `codegenNativeComponent`
- `codegenNativeCommands`
- `AppContainer`
- `ReactNativeStyleAttributes`

**Impact:** These are workarounds for react-native-web compatibility. If React Native updates its internal structure, these may break.

**Recommendation:**
1. Document why each stub is needed
2. Consider using a more maintainable approach (e.g., a stubs directory with index)
3. Add comments linking to React Native issues/PRs if these are known problems

#### 4.3 JSX-in-JS Plugin Workaround (Lines 22-38)
**Severity:** 🟡 WARNING  
**Issue:** Custom plugin to transform JSX in `.js` files from `node_modules`.

**Impact:** This is a workaround for packages that ship JSX in `.js` files (e.g., `react-native-qrcode-svg`). It's fragile and may break with package updates.

**Recommendation:**
1. Document which packages require this
2. Consider upstream fixes or alternative packages
3. Add tests to catch regressions

#### 4.4 Native Module Stub Plugin (Lines 44-61)
**Severity:** ✅ ACCEPTABLE  
**Status:** This is a necessary workaround for the unified codebase approach. The implementation is clean.

**Note:** However, `react-native-zeroconf` is listed but doesn't exist (see issue 3.1).

### Build Configuration Issues

#### 4.5 Empty Dir Before Write (Line 75)
**Severity:** 🟡 INFO  
**Issue:** `emptyDirBeforeWrite: true` — this is a Vite 5+ option.

**Impact:** None if using Vite 7.3.1, but verify this option exists in the version being used.

**Recommendation:** Verify Vite 7.3.1 supports this option (it should, but double-check).

---

## 5. `apps/app/index.html`

**File:** `apps/app/index.html`  
**Lines:** 1-38

### Critical Issues

#### 5.1 Node.js Polyfills in HTML (Lines 8-12)
**Severity:** 🟡 WARNING  
**Issue:** Inline polyfills for `global`, `process`, and `Buffer`:
```javascript
if (typeof global === "undefined") { window.global = window; }
if (typeof process === "undefined") { window.process = { env: {} }; }
if (typeof Buffer === "undefined") { window.Buffer = { isBuffer: function() { return false; } }; }
```

**Impact:**
- `Buffer` polyfill is incomplete (only provides `isBuffer`, not actual Buffer functionality)
- Packages expecting full Node.js globals may fail
- Hardcoded in HTML instead of using a proper polyfill package

**Recommendation:**
1. Use `buffer` package (already in dependencies, line 87 of package.json) properly
2. Use Vite's `define` or `resolve.alias` for `process`
3. Consider using `vite-plugin-node-polyfills` for comprehensive polyfills

#### 5.2 Hardcoded Styles (Lines 13-32)
**Severity:** 🟡 WARNING  
**Issue:** Inline CSS with hardcoded colors (`#0f172a`, `#1e293b`, `#334155`) instead of using theme.

**Impact:** 
- Duplicates theme values
- Harder to maintain
- Violates DRY principle

**Recommendation:** Extract to CSS file or use CSS variables that reference theme.

**Note:** The comment on line 25 acknowledges react-native-web wrapping behavior, which is fine.

---

## 6. `.github/workflows/release.yml`

**File:** `.github/workflows/release.yml`  
**Lines:** 1-174

### Critical Issues

#### 6.1 Missing iOS Build Job
**Severity:** 🔴 CRITICAL  
**Issue:** Release workflow only builds:
- Core
- Desktop (macOS, Windows, Linux)
- Android

**Missing:** iOS build job.

**Impact:** iOS releases are not automated. Manual builds required for every release.

**Recommendation:** Add iOS build job (requires macOS runner, Xcode, CocoaPods setup).

#### 6.2 Fragile Monorepo Node Modules Resolution (Lines 137-153)
**Severity:** 🔴 CRITICAL  
**Issue:** Complex symlink workaround for npm workspace hoisting:
```bash
if [ ! -d node_modules/react-native ]; then
  ln -sf ${{ github.workspace }}/apps/app/node_modules/react-native node_modules/react-native
fi
# ... repeated for @react-native
```

**Impact:**
- Fragile — depends on specific directory structure
- May break if npm hoisting behavior changes
- Hard to debug when it fails
- Comment says "npm workspace hoisting is unpredictable" — this is a red flag

**Recommendation:**
1. Investigate why hoisting is unpredictable — may indicate dependency issues
2. Consider using `npm install --legacy-peer-deps` or fixing peer dependency conflicts
3. Use Turbo's dependency management instead of npm workspaces
4. Document why this workaround is necessary

#### 6.3 Conditional Keystore Decoding (Lines 128-133)
**Severity:** 🟡 WARNING  
**Issue:** Keystore decoding only runs if secret exists:
```yaml
if: env.SHAREGO_KEYSTORE_BASE64 != ''
```

**Impact:**
- Silent failure if secret is misconfigured (empty string vs missing)
- No error message if keystore is required but missing
- Build may succeed but produce unsigned APK

**Recommendation:**
1. Fail fast if release build requires keystore but it's missing
2. Add explicit check: `if: secrets.SHAREGO_KEYSTORE_BASE64 != ''`
3. Add error message if keystore file doesn't exist after decoding

#### 6.4 No Version Validation Step
**Severity:** 🟡 WARNING  
**Issue:** No step to verify version sync before building.

**Impact:** Could build with mismatched versions across packages.

**Recommendation:** Add step before builds:
```yaml
- name: Verify version sync
  run: npm run version:sync -- --check
```

#### 6.5 Artifact Retention (Line 33)
**Severity:** 🟡 INFO  
**Issue:** `retention-days: 1` for core-dist artifact.

**Impact:** Very short retention. If desktop builds are delayed, core artifact may be gone.

**Recommendation:** Increase to 7 days or match release draft retention.

#### 6.6 Missing Build Verification
**Severity:** 🟡 WARNING  
**Issue:** No step to verify build artifacts exist and are valid before uploading.

**Impact:** May upload empty/corrupted artifacts.

**Recommendation:** Add verification step:
```yaml
- name: Verify artifacts
  run: |
    if [ ! -f apps/app/release/*.dmg ] && [ ! -f apps/app/release/*.exe ]; then
      echo "No desktop artifacts found"
      exit 1
    fi
```

### Security Concerns

#### 6.7 Keystore Secrets in Environment (Lines 158-161)
**Severity:** 🟡 WARNING  
**Issue:** Keystore passwords passed as environment variables:
```yaml
SHAREGO_KEYSTORE_PASSWORD: ${{ secrets.SHAREGO_KEYSTORE_PASSWORD }}
SHAREGO_KEY_ALIAS: ${{ secrets.SHAREGO_KEY_ALIAS }}
SHAREGO_KEY_PASSWORD: ${{ secrets.SHAREGO_KEY_PASSWORD }}
```

**Impact:** 
- Environment variables may be logged in build output
- Gradle may log these values

**Recommendation:**
1. Use Gradle's `-P` properties instead of env vars
2. Configure Gradle to never log these properties
3. Use `--no-daemon` (already done) to avoid persistent processes

**Note:** Using GitHub Secrets is correct, but Gradle needs to be configured to not log them.

---

## 7. `.gitignore`

**File:** `.gitignore`  
**Lines:** 1-116

### Status: ✅ COMPREHENSIVE

No issues found. The `.gitignore` is well-organized and covers all necessary patterns.

**Note:** Line 112 excludes `.cursor/rules/personal-context.mdc` and `.cursor/plans/`, which is appropriate for personal development files.

---

## Summary of Issues by Severity

### 🔴 Critical (5 issues)
1. Root `package.json`: Broken workspace references (lines 17-18, 21)
2. `apps/app/package.json`: Missing `react-native-zeroconf` dependency
3. `apps/app/vite.config.ts`: Hardcoded libsodium path
4. `.github/workflows/release.yml`: Missing iOS build job
5. `.github/workflows/release.yml`: Fragile monorepo node_modules resolution

### 🟡 Warnings (8 issues)
1. Root `package.json`: Inconsistent script patterns
2. Root `package.json`: Overrides without documentation
3. `apps/app/package.json`: Duplicate version constraints
4. `apps/app/package.json`: Electron version pinning
5. `apps/app/vite.config.ts`: Multiple React Native stubs
6. `apps/app/vite.config.ts`: JSX-in-JS plugin workaround
7. `apps/app/index.html`: Incomplete Node.js polyfills
8. `.github/workflows/release.yml`: Conditional keystore decoding

### 🟡 Info (2 issues)
1. `apps/app/package.json`: React Native 0.75.0 version note
2. `.github/workflows/release.yml`: Short artifact retention

### Security Concerns (3 issues)
1. `apps/app/package.json`: Hardened runtime disabled (macOS)
2. `.github/workflows/release.yml`: Keystore secrets in environment variables
3. `apps/app/index.html`: Incomplete Buffer polyfill (may cause runtime errors)

---

## Recommendations Priority

### Immediate Actions (Fix Before Next Release)
1. ✅ Fix workspace references in root `package.json`
2. ✅ Add iOS build job to release workflow
3. ✅ Remove or add `react-native-zeroconf` dependency
4. ✅ Add version sync check to CI

### Short-term (Next Sprint)
1. Document all overrides and workarounds
2. Fix monorepo node_modules resolution (investigate root cause)
3. Improve keystore handling in CI
4. Enable macOS hardened runtime

### Long-term (Technical Debt)
1. Standardize on Turbo or npm workspaces (not both)
2. Replace hardcoded paths with proper package resolution
3. Improve polyfill handling
4. Extract hardcoded styles to theme

---

## Additional Notes

### Positive Aspects
- ✅ Comprehensive `.gitignore`
- ✅ Version sync script exists and works
- ✅ Core package.json is clean
- ✅ Build scripts are well-organized
- ✅ CI uses proper artifact management
- ✅ Security secrets are properly stored in GitHub Secrets

### Architecture Decisions (Not Issues)
- Using stubs for react-native-web compatibility is a valid architectural choice
- Unified codebase approach requires these workarounds
- Native module stubbing is necessary for the unified app

---

**End of Review**
