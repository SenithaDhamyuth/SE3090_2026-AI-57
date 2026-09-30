const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'ExamSessions.jsx');
let content = fs.readFileSync(file, 'utf8');
content = content.replace('const url = `/api/aiagent', 'const url = `${import.meta.env.VITE_API_URL || \'https://intelliprep-rhx3.onrender.com\'}/api/aiagent');
fs.writeFileSync(file, content, 'utf8');
console.log("Fixed ExamSessions.jsx");
