const fs = require('fs');

let content = fs.readFileSync('components/AdminPowerManager.tsx', 'utf8');

// It seems my previous replace regex matched too aggressively or incorrectly and broke the JSX.
// Look at line 226: {/* TAB 4: PLAN MATRIX (Visual Editor) */} followed by broken code.
// Let's remove everything from that comment to the end of the file, and replace with a clean close.

const searchBlock = `            {/* TAB 4: PLAN MATRIX (Visual Editor) */}
            ;
                                        }}
                                        className="bg-transparent text-slate-800 font-bold text-sm outline-none w-1/2"`;

// Actually, I just need to cut everything after VISIBILITY and close the main div correctly.
content = content.replace(/\{\/\* TAB 4: PLAN MATRIX \(Visual Editor\) \*\/\}[\s\S]*/, `        </div>
    );
};
`);

fs.writeFileSync('components/AdminPowerManager.tsx', content);
