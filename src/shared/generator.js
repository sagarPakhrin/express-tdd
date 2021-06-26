const crypto = require('crypto');
const randomString = (length = 16) => {
  return crypto.randomBytes(length).toString('hex').substring(0, length); // generates 2times the length hence half taken
};
module.exports = { randomString };
