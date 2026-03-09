const fs = require('fs');

let content = fs.readFileSync('components/AdminPowerManager.tsx', 'utf8');

// I need to remove the "Subscription Plans" table from PRICING
const subsTableStart = '{/* SUBSCRIPTION PLANS */}';
const subsTableEnd = '{/* TAB 3: VISIBILITY */}';

// I will just use regex to remove it
content = content.replace(/\{\/\* SUBSCRIPTION PLANS \*\/\}[\s\S]*?\{\/\* TAB 3: VISIBILITY \*\/\}/g, '{/* TAB 3: VISIBILITY */}');

fs.writeFileSync('components/AdminPowerManager.tsx', content);
