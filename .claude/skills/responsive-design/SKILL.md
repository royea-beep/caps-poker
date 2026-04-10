---
name: responsive-design
description: "Responsive sizing for iOS portrait 320-430pt. rf/rs/rv/rh utils, fluid typography, breakpoint-aware layouts, touch-friendly sizing enforcement."
---
# Responsive Design Skill — CAPS Poker Edition

## iOS Portrait Breakpoints
| Device | Width | Notes |
|--------|-------|-------|
| iPhone SE 1st gen | 320pt | Minimum supported — test everything here |
| iPhone 12 Mini | 360pt | Small modern phone |
| iPhone SE 3rd / 12 Mini | 375pt | Common baseline |
| iPhone 14 / 13 / 12 | 390pt | **Benchmark design target** |
| iPhone 15 / 14 Pro | 393pt | Near-identical to 390 |
| iPhone 14 Plus | 428pt | Large phone |
| iPhone 15 Plus / Pro Max | 430pt | Maximum supported |

## CAPS Responsive Utilities (mandatory — never hardcode px)
```ts
import { rf, rs, rv, rh, rb } from '../utils/responsive';

rf(N)  // responsive font size
rs(N)  // responsive spacing (padding, margin, gap)
rv(N)  // responsive vertical (heights, paddingVertical)
rh(N)  // responsive horizontal (widths, paddingHorizontal)
rb(N)  // responsive border radius
```

### How they scale
- Base device: 390pt width
- Scale factor = screenWidth / 390
- rs(16) = 16px on 390pt, 13px on 320pt, 18px on 430pt

## Font Size Rules
| Use case | Size | Never below |
|----------|------|-------------|
| Micro label | rf(10) | rf(10) |
| Caption | rf(11) | rf(10) |
| Body | rf(13) | rf(11) |
| Sub-heading | rf(15-16) | rf(13) |
| Heading | rf(18-22) | rf(16) |
| Display | rf(26-32) | rf(22) |
| Hero | rf(36-48) | rf(28) |

## Touch Target Enforcement
```tsx
// BAD — visual is 32pt, no hitSlop
<Pressable style={{ width: 32, height: 32 }}>

// GOOD — visual 32pt, hit area 48pt
<Pressable
  style={{ width: 32, height: 32 }}
  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
>

// BEST — visual and hit area both 44pt
<Pressable style={{ minHeight: rs(44), minWidth: rs(44), justifyContent: 'center' }}>
```

## Spacing Scale
| Name | Value | Use |
|------|-------|-----|
| XS | rs(4) | Icon gaps, tight lists |
| SM | rs(8) | Inner padding, small gaps |
| MD | rs(12) | Card padding, button padding |
| LG | rs(16) | Section padding, screen margin |
| XL | rs(20) | Section gaps |
| 2XL | rs(24-32) | Hero spacing |

## Layout Patterns for Narrow Screens (320pt)
- Prefer `flex` columns over fixed widths
- `minWidth: 0` on flex children to allow shrinking
- `numberOfLines={1}` + `ellipsizeMode="tail"` on names
- Avoid `paddingHorizontal > rs(20)` on cards at 320pt
- Test: `const { width } = useWindowDimensions()` — log at 320

## Common Violations to Avoid
```ts
// BAD — hardcoded
fontSize: 14
padding: 12
borderRadius: 8
width: 36

// GOOD — responsive
fontSize: rf(14)
padding: rs(12)
borderRadius: rb(8)  // or rv(8)
width: rs(36)
```

## Audit Commands
```bash
# Find hardcoded font sizes:
grep -rn "fontSize: [0-9]" components/ app/ --include="*.tsx" | grep -v "rf(" | grep -v "//"

# Find hardcoded widths/heights (non-zero, non-StyleSheet noise):
grep -rn "width: [1-9][0-9]\|height: [1-9][0-9]" components/ app/ --include="*.tsx" | grep -v "rs(\|rv(\|rh("
```
