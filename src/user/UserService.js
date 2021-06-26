const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('./User');
const EmailService = require('../email/EmailService');

const generateToken = (length = 16) => {
  return crypto.randomBytes(length).toString('hex').substring(0, length); // generates 2times the length hence half taken
};

const save = async (body) => {
  const { username, email, password } = body;
  const hash = await bcrypt.hash(password, 10);
  const user = { username, email, password: hash, activationToken: generateToken(16) };
  await User.create(user);
  try {
    await EmailService.sendAccountActivation(email, user.activationToken);
  } catch (error) {
    console.log(error);
  }
};

const findByEmail = async (email) => {
  return await User.findOne({ where: { email } });
};

module.exports = { save, findByEmail };
