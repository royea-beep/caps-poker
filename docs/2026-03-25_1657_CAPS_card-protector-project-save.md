# CARD PROTECTOR PROJECT — COMPLETE SAVE FILE
# Generated: 2026-03-25 IST
# Project: Feature TABLE — Card Protector Prize
# Status: In Progress — Table+Chairs refinement phase

---

## 1. PROJECT OVERVIEW

### What
A miniature 3D-printed replica of the Feature TABLE poker setup, given as a prize to tournament winners. Functions as a "card protector" that sits on poker cards during games.

### Features
- NFC tag inside → place on phone → opens YouTube link to winner's tournament stream
- Sound module → press button → says "I'm your card protector!" / "ALL IN!"
- On/off slide switch
- Disco ball grip on top to pick up and place

### Selected Design
**#14 Tournament Pro** — oval table, 10 chairs, 4 corner poles, chip stack base, large disco ball. Currently refining table+chairs portion separately before adding top structure.

---

## 2. VERIFIED REFERENCE DATA (from real photos + website)

### Colors (EXACT — verified from photos)
| Element | Hex | Description |
|---------|-----|-------------|
| Table felt | `#2255C0` | Royal blue, matte fabric |
| Rail | `#1A1A1A` | Black padded leather |
| Betting area | `#333333` | Dark gray matte |
| Gold suits/logo | `#E8B829` | Gold/yellow metallic |
| Chair cushions | `#252525` | Dark charcoal |
| Camera lens | `#1565C0` | Blue |
| REC dot | `#FF1744` | Red |
| Branding ring | `#C62828` | Poker red |
| Gold ring variant | `#C9A837` | Gold |
| LED glow | `#42A5F5` | Blue |
| Chip red | `#B71C1C` | Deep red |
| Chip green | `#1B5E20` | Dark green |
| Chip black | `#111111` | Near black |

### Table Structure
- Shape: Oval, standard casino proportions
- Felt: Royal blue center
- Betting area: Dark gray ring with 9 gold ♠♥♦♣ symbols
- Rail: Thick black padded leather with stitch lines
- Rail logos: "♠ Feature TABLE ♠" top/bottom, "fTable.co.il" left/right
- Dealer position: front center

### Chairs (from real photos)
- Type: Banquet/conference style
- Frame: Thin black tubular steel
- Seat: Padded rectangle, black vinyl/leather
- Backrest: Padded rectangle, slightly curved
- Legs: 4 legs — front straight, back angled
- Count: 9 players + 1 dealer (marked "D")

### Camera Setup (from real photos)
- Overhead rig: metal arm from ceiling, board cam pointing down
- Side cameras on tripods
- 4 cameras total
- TV monitor on ceiling showing timer/blinds

### Logo
- Feature TABLE: spade ♠ icon + "Feature TABLE" text
- Gold #E8B829 on dark background
- Vector PDF available at: `GFX/logos/feature_table_logo.pdf`
- PNG transparent: `GFX/logos/feature_table_logo_nobg.png`

---

## 3. DIMENSIONS (target for miniature)
| Part | Size |
|------|------|
| Total height | ~80mm |
| Table width (long) | ~70mm |
| Table depth (short) | ~45mm |
| Base footprint | ~75mm × 50mm |
| Disco ball | ~25mm diameter |
| Chair height | ~12mm |
| Rail thickness | ~3mm |

---

## 4. ELECTRONICS SPEC
| Component | Spec | Qty per unit |
|-----------|------|-------------|
| NFC sticker | NTAG215, 25mm round, 13.56MHz | 1 |
| Sound module | Greeting card type, push button, 10-30 sec | 1 |
| Battery | CR2032 3V lithium | 1 |
| Push button | 6mm tactile switch | 1 |
| Slide switch | SS12D00 SPDT mini | 1 |
| Speaker | 8Ω 0.5W, 20-28mm, ultra thin | 1 (if not in module) |

### Sound Messages (pre-recorded)
1. "Hey! I'm your card protector! I guard your cards at the Feature Table!"
2. "ALL IN!"
3. "Put me on your phone to watch the winning moment!"

### NFC Programming
- App: NFC Tools (free, iOS + Android)
- Each tag gets unique URL: `https://youtube.com/watch?v=XXXXX`
- NTAG215 compatible with iPhone + Android

---

## 5. MESHY.AI ACCOUNT
- Credits: started with 1,100
- Used ~400 (15 previews + 5 refines)
- Remaining: ~700
- API key: stored in bot's environment (MESHY_API_KEY)
- API endpoint: `https://api.meshy.ai/openapi/v2/text-to-3d`
- Model: meshy-6 (20 credits per preview, ~20 per refine)

### All 15 Designs Generated
| # | Name | Hebrew | Status |
|---|------|--------|--------|
| 1 | Classic Replica | העתק קלאסי | Preview + Refined ✅ |
| 2 | Crystal Globe | גלובוס קריסטל | Preview ✅ |
| 3 | Compact Low | קומפקטי נמוך | Preview ✅ |
| 4 | Tower Edition | מהדורת מגדל | Preview ✅ |
| 5 | Spade Crown | כתר ספייד | Preview + Refined ✅ |
| 6 | Double Ring | טבעת כפולה | Preview ✅ |
| 7 | VIP Gold | VIP זהב | Preview ✅ |
| 8 | Quad Truss | 4 עמודים | Preview + Refined ✅ |
| 9 | LED Ring Base | בסיס LED | Preview ✅ |
| 10 | Chip Stack | בסיס צ׳יפים | Preview ✅ |
| 11 | Royal Flush | רויאל פלאש | Preview ✅ |
| 12 | Stealth Black | סטלת׳ שחור | Preview ✅ |
| 13 | Neon Vegas | ניאון וגאס | Preview ✅ |
| 14 | Tournament Pro | טורניר פרו | Preview + Refined ✅ **SELECTED** |
| 15 | Diamond Spade | ספייד יהלום | Preview + Refined ✅ |

### Current Phase
Generating table+chairs ONLY (3 angles) — perfecting base before adding top structure.

### Files Location
```
C:\Users\royea\Downloads\meshy_renders\          — 15 preview PNGs
C:\Users\royea\Downloads\meshy_renders\refined\   — 5 refined PNGs + GLB + STL
C:\Users\royea\Downloads\meshy_renders\table_only\ — table+chairs renders (in progress)
C:\Users\royea\Downloads\card_protector_gallery.html — visual gallery of all 20
```

---

## 6. PROMPTS CREATED (for reuse)

### Delivered as .md files:
| File | Purpose |
|------|---------|
| `feature_table_card_protector_prompt.md` | Full product spec for 3D designer |
| `dashboard_prompt_for_claude.md` | Build HTML dashboard |
| `PROMPT_extract_table_reference.md` | Get reference images from ftable-hands |
| `PROMPT_deliver_reference_files.md` | Get actual files from ftable-hands |
| `PROMPT_meshy_15_variations.md` | 15 short prompts for Meshy |
| `PROMPT_meshy_api_script.md` | Python script for 15 generations |
| `PROMPT_meshy_2_tests_only.md` | Conservative 2-test approach |
| `PROMPT_run_meshy_auto.md` | Full automation script |
| `PROMPT_refine_and_send_renders.md` | Refine top 3 + deliver |
| `PROMPT_refine_14_15_final_choice.md` | Refine #14 + #15 |
| `PROMPT_send_all_renders_now.md` | Show renders to user |
| `PROMPT_EMERGENCY_show_images.md` | Force-open images on screen |
| `PROMPT_build_dashboard_v2.md` | Full dashboard mega prompt |
| `PROMPT_3D_design_all_15_variations.md` | Complete 3D brief for all 15 |
| `PROMPT_table_chairs_only.md` | Table+chairs only, no top |
| `PROMPT_step1_adapt_for_printing.md` | Adapt STL for 3D printing |
| `PROMPT_step2_order_components.md` | AliExpress component order |
| `PROMPT_step3_find_3d_printing_israel.md` | Find Israeli 3D print service |

### Other deliverables:
| File | Purpose |
|------|---------|
| `robot_parts_list.xlsx` | Original robot parts (deprecated) |
| `card_protector_robot_parts.xlsx` | Card protector parts list |
| `card-protector-selector.html` | Dashboard v1 (React) |
| `selector.html` | Dashboard attempt |

---

## 7. WORKFLOW PATTERNS (Reverse Engineered)

### Communication Style
- **Language**: Hebrew for conversation, English for prompts/code
- **Big Boss role**: Approves decisions, never executes. Says what he wants, team delivers.
- **Manager (me) role**: Consults internally, presents 3 options, prepares .md prompts
- **Bot team role**: Executes prompts automatically, returns results

### Decision Flow
```
Big Boss has idea
    ↓
Manager asks clarifying questions (widget/choices when possible)
    ↓
Manager prepares .md prompt file
    ↓
Big Boss transfers prompt to relevant bot
    ↓
Bot executes and returns results
    ↓
Big Boss reviews results
    ↓
Manager recommends 3 next steps
    ↓
Big Boss approves one
    ↓
Repeat
```

### Rules Learned the Hard Way
1. **NEVER tell the Big Boss to do manual tasks** — always prepare prompts for bots
2. **NEVER skip showing results** — Big Boss must SEE before deciding
3. **Always deliver prompts as .md files** — not inline text
4. **Always present 3 options** — not just one recommendation
5. **Start small, iterate** — 2 tests before 15, table before full model
6. **Cross-project bots exist** — use ftable-hands for assets, ZProjectManager for tools
7. **Force-show images** — bots tend to describe instead of display. Use `start ""` or HTML gallery
8. **Include RULE #0** in every prompt — "user NEVER does manual steps"
9. **Include "Yes, allow all edits in components"** at start and end of every prompt
10. **Include FINAL REPORT FORMAT** table in every prompt
11. **Hebrew UI, English technical** — always
12. **Don't rush ahead** — get approval at each stage

### What NOT to Do
- Don't suggest the Big Boss opens files, navigates folders, or runs commands
- Don't recommend monetization/payments unless asked
- Don't generate SVG/visual previews when AI 3D tools are available
- Don't describe images in text — display them
- Don't proceed without Big Boss seeing results first
- Don't make excuses about limitations — find a way or ask a bot

---

## 8. GEMS & UTILS (Reusable across projects)

### Meshy.ai API Pattern
```python
# Reusable Meshy generation function
import requests, os, time

def meshy_generate(prompt, name, api_key=None, refine=True, neg_prompt="low quality, ugly, blurry"):
    key = api_key or os.environ.get("MESHY_API_KEY")
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    base = "https://api.meshy.ai/openapi/v2/text-to-3d"
    
    # Preview
    resp = requests.post(base, headers=headers, json={
        "mode": "preview", "prompt": prompt,
        "negative_prompt": neg_prompt, "ai_model": "meshy-6",
        "target_formats": ["glb", "stl"]
    })
    tid = resp.json()["result"]
    
    # Poll
    while True:
        time.sleep(10)
        task = requests.get(f"{base}/{tid}", headers=headers).json()
        if task["status"] in ["SUCCEEDED", "FAILED"]: break
    
    if task["status"] != "SUCCEEDED": return None
    
    # Optional refine
    if refine:
        rr = requests.post(base, headers=headers, json={
            "mode": "refine", "preview_task_id": tid,
            "enable_pbr": True, "ai_model": "meshy-6"
        })
        ref_id = rr.json()["result"]
        while True:
            time.sleep(15)
            rt = requests.get(f"{base}/{ref_id}", headers=headers).json()
            if rt["status"] in ["SUCCEEDED", "FAILED"]: break
        task = rt
    
    # Download
    results = {}
    for key_name in ["thumbnail_url"]:
        url = task.get(key_name, "")
        if url:
            data = requests.get(url)
            path = f"{name}.png"
            with open(path, "wb") as f: f.write(data.content)
            results["png"] = path
    for fmt in ["glb", "stl"]:
        url = task.get("model_urls", {}).get(fmt, "")
        if url:
            data = requests.get(url)
            path = f"{name}.{fmt}"
            with open(path, "wb") as f: f.write(data.content)
            results[fmt] = path
    
    return results
```

### Force-Show Images Pattern (Windows)
```bash
# Open images directly
start "" "path\to\image.png"

# Create HTML gallery from folder
node -e "
const fs=require('fs'),path=require('path');
const dir='FOLDER_PATH';
let imgs=[];
fs.readdirSync(dir).filter(f=>f.endsWith('.png')).forEach(f=>{
  const b64=fs.readFileSync(path.join(dir,f)).toString('base64');
  imgs.push({name:f,src:'data:image/png;base64,'+b64});
});
const html='<!DOCTYPE html><html><body style=\"background:#111;color:#fff;font-family:sans-serif;padding:20px\"><div style=\"display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px\">'+imgs.map(i=>'<div style=\"background:#1a1a1a;border-radius:12px;padding:12px;text-align:center\"><img src=\"'+i.src+'\" style=\"width:100%;border-radius:8px\"><p>'+i.name+'</p></div>').join('')+'</div></body></html>';
fs.writeFileSync('gallery.html',html);
"
start "" "gallery.html"
```

### NFC Programming Command
```
# Using NFC Tools app (iOS/Android):
# 1. Open NFC Tools → Write → Add record → URL
# 2. Enter: https://youtube.com/watch?v=VIDEO_ID
# 3. Hold phone to NTAG215 sticker → Write
```

### Cross-Project File Access Pattern
```
# Ask bot in project X to find and send files:
# 1. Describe what you need
# 2. Bot searches with: dir /s /b "path\*.ext"
# 3. Bot sends files to chat
# 4. User uploads to target project
```

---

## 9. NEXT STEPS (pending Big Boss approval)

### Immediate
- [ ] Review table+chairs only renders (3 angles, in progress)
- [ ] Approve table+chairs design
- [ ] Add camera rig + disco ball on top

### Production
- [ ] Adapt STL for 3D printing (3 parts, electronics cavities)
- [ ] Order components from AliExpress (prompts ready)
- [ ] Find Israeli 3D printing service (prompt ready)
- [ ] Test print Part A (base with electronics)
- [ ] Assembly + paint test unit
- [ ] Produce batch of 10

### Prompts Ready but Not Sent
- `PROMPT_step1_adapt_for_printing.md` — waiting for final design approval
- `PROMPT_step2_order_components.md` — waiting for design lock
- `PROMPT_step3_find_3d_printing_israel.md` — waiting for design lock

---

## 10. PROJECT TIMELINE
| Date | Milestone |
|------|-----------|
| 2026-03-25 | Project started — concept, specs, reference gathered |
| 2026-03-25 | 15 Meshy previews generated |
| 2026-03-25 | 5 refined with colors |
| 2026-03-25 | #14 Tournament Pro selected |
| 2026-03-25 | Table+chairs refinement in progress |
| TBD | Final design approved |
| TBD | STL adapted for printing |
| TBD | Components ordered |
| TBD | Test print |
| TBD | First batch of 10 produced |
