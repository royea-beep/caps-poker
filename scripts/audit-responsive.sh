#!/bin/bash
echo "=== CAPS Responsive Audit ==="

echo ""
echo "--- Hardcoded font sizes (should be rf()) ---"
grep -rn "fontSize: [0-9]" components/ app/ --include="*.tsx" 2>/dev/null | \
  grep -v "//\|0\.\|test" | grep -v "rf(" | head -10

echo ""
echo "--- Hardcoded widths/heights (should be rs()/rv()) ---"
grep -rn "width: [1-9][0-9]\|height: [1-9][0-9]" components/ app/ --include="*.tsx" 2>/dev/null | \
  grep -v "//\|test\|rs(\|rv(\|rh(\|'100%'\|\"100%\"" | head -10

echo ""
echo "--- Small touch targets (< 44pt, no hitSlop) ---"
grep -rn "height: rs([0-9]\b\|height: rs([1-3][0-9]\b" components/ app/ --include="*.tsx" 2>/dev/null | \
  grep -v "rs(4[4-9]\|rs([5-9]\|borderRadius\|//" | head -5

echo ""
echo "--- Pressable/TouchableOpacity without minHeight or hitSlop ---"
MISSING=$(grep -rn "Pressable\|TouchableOpacity" components/ app/ --include="*.tsx" 2>/dev/null | \
  grep -v "minHeight\|hitSlop\|//" | wc -l)
echo "  Count: $MISSING (review manually — many are fine with content sizing)"

echo ""
echo "=== Done ==="
