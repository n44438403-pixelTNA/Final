const fs = require('fs');

let content = fs.readFileSync('components/AdminPowerManager.tsx', 'utf8');

// I will remove PACKAGES and PRICING since they are completely managed in STORE_MANAGER now.
// Actually, PRICING might have other things like nameChangeCost, profileEditCost, deepDiveCost. Let's see what PRICING has.
