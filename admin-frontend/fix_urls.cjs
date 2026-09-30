const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.jsx'));

const replacementString = "(import.meta.env.VITE_API_URL || 'https://intelliprep-rhx3.onrender.com')";
const replacementTemplate = "";

files.forEach(file => {
    const filePath = path.join(srcDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace standard strings: 'http://localhost:5087...'
    content = content.replace(/'http:\/\/localhost:5087/g, replacementString + " + '");
    
    // Replace template literals: http://localhost:5087...
    content = content.replace(/http:\/\/localhost:5087/g, "" + replacementTemplate);
    
    // Replace double quotes if any
    content = content.replace(/"http:\/\/localhost:5087/g, replacementString + ' + "');

    fs.writeFileSync(filePath, content, 'utf8');
});
console.log('Done replacing URLs');
