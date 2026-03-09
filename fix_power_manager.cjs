const fs = require('fs');

let content = fs.readFileSync('components/AdminPowerManager.tsx', 'utf8');

// The user wants to remove "subscraption plan" from the Power Manager because it is now controlled in the new STORE_MANAGER tab.
// Currently the tabs are: 'PRICING' | 'VISIBILITY' | 'PLAN_MATRIX' | 'PACKAGES'
// Actually wait, looking at the grep earlier:
// let's check what tabs are rendered.

// Remove PLAN_MATRIX tab button
content = content.replace(/\{ id: 'PLAN_MATRIX', icon: List, label: 'Plan Matrix' \},/g, '');

// Remove PLAN_MATRIX activeTab view
content = content.replace(/\{\/\* TAB 4: SUBSCRIPTION PLANS \*\/\}[\s\S]*?\{\/\* TAB 5: PACKAGES \*\/\}/g, '{/* TAB 5: PACKAGES */}');
// Let's use string replace for safety, since we found PLAN_MATRIX starts at line 303.

const searchBlock = `            {/* TAB 4: SUBSCRIPTION PLANS (Deleted earlier? no wait, it's PLAN_MATRIX) */}`;

// Actually let's just use regex to remove the whole PLAN_MATRIX block.
content = content.replace(/\{\/\* TAB 4: PLAN MATRIX \*\/\}[\s\S]*?\{\/\* TAB 5: PACKAGES \*\/\}/, '{/* TAB 5: PACKAGES */}');

// Let's just be very precise.
content = content.replace(/\{activeTab === 'PLAN_MATRIX' && \([\s\S]*?\}\)/, '');

fs.writeFileSync('components/AdminPowerManager.tsx', content);
