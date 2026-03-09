const fs = require('fs');

let file = fs.readFileSync('components/StudentDashboard.tsx', 'utf8');

// We need to add the definition for isStudyMode just before return (
let target = "  return (";
let replacement = `  const isStudyMode = activeTab === 'VIDEO' || activeTab === 'PDF' || activeTab === 'MCQ' || activeTab === 'AUDIO' || (contentViewStep === 'PLAYER' && activeTab !== 'HOME') || activeTab === 'WEEKLY_TEST' || activeTab === 'CHALLENGE_20';

  return (`;

let newFile = file.replace(target, replacement);

fs.writeFileSync('components/StudentDashboard.tsx', newFile);

console.log(newFile.indexOf(replacement) !== -1 ? "Replaced successfully" : "Replacement failed");
