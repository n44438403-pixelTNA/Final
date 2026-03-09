const fs = require('fs');

let content = fs.readFileSync('components/AdminPowerManager.tsx', 'utf8');

// I need to make sure the main wrapper div is closed.
// Currently it's:
//            )}
//
//                    </div>
//    );

// It should just be closing the root div.
content = content.replace(/                \} \n\s*\)\}\n\n                    <\/div>\n    \);\n\};\n/, `                </div>
            )}
        </div>
    );
};
`);

fs.writeFileSync('components/AdminPowerManager.tsx', content);
