const fs = require('fs');

let content = fs.readFileSync('components/AdminPowerManager.tsx', 'utf8');

// There is also 'PACKAGES' which is now in Store Manager. I should remove that too.
// Wait, the user said "subscraption cradit aur dummy price subscraotion ka control higa" in "naya price wala page se" (Store page).
// This implies PRICING and PACKAGES are redundant in Power Manager now since they were moved to Store Manager.

content = content.replace(/\{ id: 'PACKAGES', icon: Banknote, label: 'Credit Packages' \},/, '');
content = content.replace(/\{\/\* TAB 5: PACKAGES \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*\)\}/, '');

// The remaining tabs would be VISIBILITY (if it exists) and whatever else was there.
// Let's verify what tabs were originally there.
