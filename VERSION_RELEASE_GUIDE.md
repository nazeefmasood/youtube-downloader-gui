# Version Release Guide

Quick reference for managing versions and releases for VidGrab.

## 📦 Release a New Version (e.g., 1.2.0)

### Step 1: Update Version
```bash
# Edit version.json
nano version.json  # Change "version": "1.2.0"

# Run update script to sync all files
node scripts/update-version.js
```

### Step 2: Commit Changes
```bash
# Stage all version-related files
git add version.json package.json extension/manifest.json src/version.ts src/App.tsx

# Commit with descriptive message
git commit -m "chore: bump version to 1.2.0"
```

### Step 3: Create Git Tag
```bash
# Create annotated tag
git tag -a v1.2.0 -m "Release version 1.2.0"
```

### Step 4: Push to Origin
```bash
# Push commits and tags
git push origin main
git push origin v1.2.0

# Or push everything at once
git push origin main --tags
```

---

## 🗑️ Delete Old Tag (if you made a mistake)

### Delete Local Tag
```bash
git tag -d v1.2.0
```

### Delete Remote Tag
```bash
git push origin :refs/tags/v1.2.0
# Or alternatively:
git push origin --delete v1.2.0
```

---

## 🔄 Re-release a Version (delete old, create new)

If you need to re-tag after making changes:

```bash
# 1. Delete local tag
git tag -d v1.2.0

# 2. Delete remote tag
git push origin :refs/tags/v1.2.0

# 3. Create new tag on current commit
git tag -a v1.2.0 -m "Release version 1.2.0"

# 4. Push new tag
git push origin v1.2.0
```

---

## 📋 Useful Git Commands

### View All Tags
```bash
git tag -l
```

### View Tag Details
```bash
git show v1.2.0
```

### View Recent Commits
```bash
git log --oneline -n 5
```

### Check Current Status
```bash
git status
```

### View Tag on Remote
```bash
git ls-remote --tags origin
```

---

## 🚀 Complete Release Workflow Example

For releasing version **1.2.0**:

```bash
# 1. Update version
nano version.json  # Set to "1.2.0"
node scripts/update-version.js

# 2. Commit changes
git add .
git commit -m "chore: bump version to 1.2.0"

# 3. Create and push tag
git tag -a v1.2.0 -m "Release version 1.2.0"
git push origin main --tags

# Done! ✅
```

---

## 💡 Pro Tips

- **Always run `node scripts/update-version.js`** after editing `version.json` - it ensures all files stay in sync
- **Use semantic versioning**: MAJOR.MINOR.PATCH (e.g., 1.2.0)
  - MAJOR: Breaking changes
  - MINOR: New features (backward compatible)
  - PATCH: Bug fixes
- **Annotated tags** (`-a`) are better than lightweight tags - they include author info and dates
- **Check before pushing**: Run `git log --oneline -n 3` to verify your commit is correct
