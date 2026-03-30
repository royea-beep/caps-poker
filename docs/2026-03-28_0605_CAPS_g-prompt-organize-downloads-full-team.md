# 🏢 G-PROMPT: ORGANIZE DOWNLOADS - FULL TEAM OPERATION
> Execute with Claude Code on Windows
> Target: C:\Users\{username}\Downloads

---

## 🎯 MISSION

You are the CEO of a file organization company. You have a full team to help you scan, analyze, categorize, and organize ALL files in the Downloads folder. 

**DO NOT just dump files to TODELETE!**

Every file must be:
1. **Opened and read** - understand what's inside
2. **Categorized** - which project does it belong to
3. **Evaluated** - is it useful? duplicate? needs integration?
4. **Placed correctly** - in the right project folder

---

## 👥 YOUR TEAM

### 👔 CEO (You - Claude Code)
- Oversee the entire operation
- Make final decisions on edge cases
- Generate summary report at the end

### 👩‍💼 Secretary Team Leaders

**Sarah - Empire Lead**
- Handles: Cross-project files, MEGA prompts, G-PROMPTs, dashboards, VAMOS pipeline
- Folder: `ROYEA-EMPIRE/Empire/`

**Dana - CAPS Lead**  
- Handles: CAPS Card Game files, poker, chips, hands, UX fixes
- Folder: `ROYEA-EMPIRE/CAPS/`

**Michal - WINGMAN Lead**
- Handles: WINGMAN dating app, matching, bots, spot-the-bot, gamification
- Folder: `ROYEA-EMPIRE/WINGMAN/`

**Noa - 9Soccer Lead**
- Handles: 9Soccer WEB trivia game (the main game)
- Folder: `ROYEA-EMPIRE/9Soccer/`

**Yael - 9Soccer-Mascots Lead** ⭐ NEW
- Handles: 9Soccer-Mascots iOS APP (separate from 9Soccer web!)
- Folder: `ROYEA-EMPIRE/9Soccer-Mascots/`

**Tamar - FTABLE/Legacy Lead** ⭐ NEW
- Handles: Old FTABLE files, legacy code, archived sessions
- Folder: `ROYEA-EMPIRE/Archive/`

### 👩‍💻 Analysis Team
- **Analyst 1**: Reads file content
- **Analyst 2**: Identifies project keywords
- **Analyst 3**: Checks for duplicates
- **Analyst 4**: Flags integration needs

---

## 📁 FOLDER STRUCTURE TO CREATE

```
Downloads/
└── ROYEA-EMPIRE/
    ├── Empire/              # Cross-project, MEGA prompts, G-PROMPTs
    ├── CAPS/                # CAPS Card Game
    ├── WINGMAN/             # WINGMAN Dating App
    ├── 9Soccer/             # 9Soccer WEB (trivia game)
    ├── 9Soccer-Mascots/     # 9Soccer iOS APP (mascots) ⭐ SEPARATE!
    ├── Archive/             # FTABLE, legacy, old sessions
    ├── NEEDS-REVIEW/        # Files that need Roye's decision
    └── TODELETE/            # Only CONFIRMED duplicates
```

---

## 🔍 PROJECT IDENTIFICATION KEYWORDS

### Empire (cross-project)
```
ROYEA-EMPIRE, MEGA-PROMPT, G-PROMPT-MASTER, G-PROMPT-HEALTH, G-PROMPT-ECONOMY,
G-PROMPT-DEPLOY, G-PROMPT-BUG, G-PROMPT-AUTO-FIX, G-PROMPT-EDGE,
G-PROMPT-DAILY, G-PROMPT-USER-SIMULATION, G-PROMPT-STAKEHOLDER,
empire-dashboard, royea-empire-manager, VAMOS-Pipeline, Cross-Project,
EMPIRE-LIVE-DASHBOARD, ECONOMY-FRONTEND-WIRING (if cross-project)
```

### CAPS
```
CAPS, caps-poker, poker, chips (not coins!), hands_played, card game,
chip_config, chip_transactions, leaderboard (CAPS context), 
HOOKS-CRASH, UX-FIXES, card readability, deal, fold, raise
```

### WINGMAN
```
WINGMAN, wingman, dating, matching, pairings, spot-the-bot, spot_the_bot,
bots, profiles, swipes, founding_wings, coin_wallets (WINGMAN context),
GAMIFICATION (WINGMAN), daily_rewards, achievements (WINGMAN)
```

### 9Soccer WEB (Main Trivia Game)
```
9Soccer (without Mascots), 9soccer, trivia, questions, challenges,
characters (trivia context), wc2026, world cup, battle_rooms,
israeli league, badges, coin_wallets (9Soccer context)
```

### 9Soccer-Mascots iOS APP ⭐ DIFFERENT PROJECT!
```
9Soccer-Mascots, mascots, trivia-mascots, Capacitor, iOS build,
GitHub Actions, TestFlight (mascots context), com.ftable.ninetysoccer,
Apple ID 6761273153
```

### Archive/Legacy
```
FTABLE_, ftable, old sessions with dates (2026-03-*), 
SESSION-*, session_*, old summaries, deprecated
```

---

## 📋 FILE ANALYSIS PROCESS

For EACH file:

### Step 1: Read Content
```powershell
$content = Get-Content -Path $file.FullName -TotalCount 50
```

### Step 2: Extract Keywords
Look for:
- Project names in content
- Supabase project IDs
- Apple IDs
- Specific table names
- Function names

### Step 3: Categorize
| Found Keyword | Category |
|---------------|----------|
| `gxrpunvhjcrzqnitbqah` | CAPS |
| `rndqegtkcuqichobzypz` | WINGMAN |
| `psxqlmgsifvsmiijkucu` | 9Soccer |
| `6760429619` | CAPS |
| `6760245903` | WINGMAN |
| `6760544822` | 9Soccer |
| `6761273153` | 9Soccer-Mascots |
| `chip_config`, `earn_chips` | CAPS |
| `coin_wallets` + `pairings` | WINGMAN |
| `coin_wallets` + `trivia` | 9Soccer |
| `Capacitor`, `GitHub Actions` | 9Soccer-Mascots |

### Step 4: Check for Duplicates
- Same filename = check content hash
- Similar names = compare content
- Numbered versions (1), (2) = keep newest, TODELETE older

### Step 5: Flag for Integration
If file contains USEFUL NEW INFO not in existing files:
- Move to `NEEDS-REVIEW/`
- Add to integration report

---

## 🚫 TODELETE RULES (STRICT!)

Only move to TODELETE if:
1. **Exact duplicate** - same content, different name
2. **Old version** - newer version exists with same content
3. **Empty file** - no useful content
4. **Corrupted** - unreadable

**DO NOT TODELETE:**
- Files with unique information
- Files you're not sure about (→ NEEDS-REVIEW)
- Session files that might have learnings

---

## 💻 EXECUTION STEPS

### Phase 1: Setup
```powershell
$downloads = "$env:USERPROFILE\Downloads"
$base = "$downloads\ROYEA-EMPIRE"

# Create all folders
$folders = @("Empire", "CAPS", "WINGMAN", "9Soccer", "9Soccer-Mascots", "Archive", "NEEDS-REVIEW", "TODELETE")
foreach ($f in $folders) {
    New-Item -ItemType Directory -Force -Path "$base\$f" | Out-Null
}
```

### Phase 2: Scan All Files
```powershell
$files = Get-ChildItem -Path $downloads -File -Recurse | Where-Object {
    $_.Extension -in @(".md", ".jsx", ".png", ".json", ".txt") -and
    $_.DirectoryName -eq $downloads  # Only root level
}

Write-Host "Found $($files.Count) files to process"
```

### Phase 3: Analyze Each File
```powershell
$report = @()

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -TotalCount 100 -ErrorAction SilentlyContinue
    $contentStr = $content -join " "
    
    $category = "NEEDS-REVIEW"  # Default
    $reason = ""
    
    # Check for project identifiers
    if ($contentStr -match "gxrpunvhjcrzqnitbqah|CAPS|caps-poker|chip_config|earn_chips") {
        $category = "CAPS"
        $reason = "CAPS project identifier found"
    }
    elseif ($contentStr -match "rndqegtkcuqichobzypz|WINGMAN|wingman|spot.the.bot|pairings") {
        $category = "WINGMAN"
        $reason = "WINGMAN project identifier found"
    }
    elseif ($contentStr -match "Mascots|mascots|trivia-mascots|Capacitor|6761273153|com.ftable.ninetysoccer") {
        $category = "9Soccer-Mascots"
        $reason = "9Soccer-Mascots identifier found"
    }
    elseif ($contentStr -match "psxqlmgsifvsmiijkucu|9Soccer|9soccer|trivia|wc2026|battle_rooms") {
        $category = "9Soccer"
        $reason = "9Soccer project identifier found"
    }
    elseif ($contentStr -match "ROYEA-EMPIRE|MEGA-PROMPT|G-PROMPT|empire-dashboard|Cross-Project") {
        $category = "Empire"
        $reason = "Empire/cross-project identifier found"
    }
    elseif ($contentStr -match "FTABLE|ftable" -or $file.Name -match "^FTABLE_") {
        $category = "Archive"
        $reason = "Legacy FTABLE file"
    }
    elseif ($file.Name -match "\(\d+\)\.md$") {
        # Numbered duplicate like "file (1).md"
        $category = "TODELETE"
        $reason = "Numbered duplicate"
    }
    
    $report += [PSCustomObject]@{
        File = $file.Name
        Category = $category
        Reason = $reason
        Size = $file.Length
    }
    
    # Move file
    $destPath = "$base\$category\$($file.Name)"
    if (-not (Test-Path $destPath)) {
        Move-Item -Path $file.FullName -Destination $destPath
        Write-Host "✅ $($file.Name) -> $category ($reason)"
    } else {
        # Duplicate filename - add to TODELETE with suffix
        $dupName = "$($file.BaseName)_DUP_$(Get-Date -Format 'HHmmss')$($file.Extension)"
        Move-Item -Path $file.FullName -Destination "$base\TODELETE\$dupName"
        Write-Host "🗑️ $($file.Name) -> TODELETE (duplicate filename)"
    }
}
```

### Phase 4: Generate Report
```powershell
$summary = @"
# 📊 FILE ORGANIZATION REPORT
Generated: $(Get-Date)

## Summary
| Category | Count |
|----------|-------|
| Empire | $($report | Where-Object {$_.Category -eq 'Empire'} | Measure-Object).Count |
| CAPS | $($report | Where-Object {$_.Category -eq 'CAPS'} | Measure-Object).Count |
| WINGMAN | $($report | Where-Object {$_.Category -eq 'WINGMAN'} | Measure-Object).Count |
| 9Soccer | $($report | Where-Object {$_.Category -eq '9Soccer'} | Measure-Object).Count |
| 9Soccer-Mascots | $($report | Where-Object {$_.Category -eq '9Soccer-Mascots'} | Measure-Object).Count |
| Archive | $($report | Where-Object {$_.Category -eq 'Archive'} | Measure-Object).Count |
| NEEDS-REVIEW | $($report | Where-Object {$_.Category -eq 'NEEDS-REVIEW'} | Measure-Object).Count |
| TODELETE | $($report | Where-Object {$_.Category -eq 'TODELETE'} | Measure-Object).Count |

## Files Needing Review
$($report | Where-Object {$_.Category -eq 'NEEDS-REVIEW'} | ForEach-Object { "- $($_.File)" })

## Files Marked for Deletion
$($report | Where-Object {$_.Category -eq 'TODELETE'} | ForEach-Object { "- $($_.File): $($_.Reason)" })
"@

$summary | Out-File "$base\ORGANIZATION-REPORT.md"
Write-Host "`n📄 Report saved to ROYEA-EMPIRE/ORGANIZATION-REPORT.md"
```

---

## ✅ FINAL CHECKLIST

After running:

1. [ ] Check `NEEDS-REVIEW/` - manually categorize remaining files
2. [ ] Check `TODELETE/` - verify nothing important before deleting
3. [ ] Review `ORGANIZATION-REPORT.md` for summary
4. [ ] Verify each project folder has correct files
5. [ ] Report back to Roye!

---

## 📝 IMPORTANT NOTES

- **9Soccer ≠ 9Soccer-Mascots** - These are DIFFERENT projects!
- **FTABLE = Legacy** - Old naming convention, archive it
- **Session files** - May contain useful learnings, don't delete blindly
- **When in doubt → NEEDS-REVIEW**, not TODELETE

---

**Execute this prompt thoroughly. Every file matters!** 🎯
