const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('./User');
const EmailService = require('../email/EmailService');
const sequelize = require('../config/database');
const EmailException = require('../email/EmailException');

const generateToken = (length = 16) => {
  return crypto.randomBytes(length).toString('hex').substring(0, length); // generates 2times the length hence half taken
};

const save = async (body) => {
  const { username, email, password } = body;
  const hash = await bcrypt.hash(password, 10);
  const user = { username, email, password: hash, activationToken: generateToken(16) };
  const transaction = await sequelize.transaction();
  await User.create(user, { transaction });
  try {
    await EmailService.sendAccountActivation(email, user.activationToken);
    transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw new EmailException();
  }
};

const findByEmail = async (email) => {
  return await User.findOne({ where: { email } });
};

module.exports = { save, findByEmail };
