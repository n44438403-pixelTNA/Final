const fs = require('fs');

let content = fs.readFileSync('components/AdminPowerManager.tsx', 'utf8');

// I'll just find the end manually and replace it

const newEnd = `                    </div>
                </div>
            )}
        </div>
    );
};`;

content = content.replace(/                     <\/div>\n                <\/div>\n            \)\}\n\n                    <\/div>\n    \);\n\};\n/, newEnd);

fs.writeFileSync('components/AdminPowerManager.tsx', content);
