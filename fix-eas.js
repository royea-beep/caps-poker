const fs = require('fs');
const data = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
data.build.production.ios.ascApiKeyPath = 'C:\Projects\_KEYS\9soccer\AuthKey_6WF8UY7742_ASC-API.p8';
data.build.production.ios.ascApiKeyId = '6WF8UY7742';
data.build.production.ios.ascApiKeyIssuerId = '686f97b8-3f8a-40b7-a6cd-5293a3168439';
fs.writeFileSync('eas.json', JSON.stringify(data, null, 2) + '\n');
console.log('done');
