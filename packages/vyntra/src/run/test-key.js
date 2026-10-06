const crypto = require('node:crypto');

// A test's identity across runs: its describe blocks and name.
const testKey = (titlePath) => titlePath.join(' > ');

// A name for a test's files (its failure page, its artifacts): readable, unique by the hash, and the same in every
// run. file is the test file from the root; titlePath null for the file itself.
function slugOf(file, titlePath) {
  const key = titlePath ? `${file} > ${testKey(titlePath)}` : file;
  const readable = key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return `${readable}-${crypto.createHash('sha1').update(key).digest('hex').slice(0, 8)}`;
}

module.exports = { testKey, slugOf };
