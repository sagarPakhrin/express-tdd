const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('./User');
const EmailService = require('../email/EmailService');
const sequelize = require('../config/database');
const Sequelize = require('sequelize');
const EmailException = require('../email/EmailException');
const InvalidTokenException = require('../user/InvalidTokenException');
const UserNotFondException = require('./UserNotFondException');

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

const activate = async (token) => {
  const user = await User.findOne({ where: { activationToken: token } });
  if (!user) {
    throw new InvalidTokenException();
  }
  user.inactive = false;
  user.activationToken = null;
  await user.save();
};

const getUsers = async (page, size, authUser) => {
  const usersWithCount = await User.findAndCountAll({
    where: {
      inactive: false,
      id: {
        [Sequelize.Op.not]: authUser ? authUser.id : 0,
      },
    },
    attributes: ['id', 'username', 'email'],
    limit: size,
    offset: page * size,
  });
  return {
    items: usersWithCount.rows,
    page,
    size: size,
    totalPages: Math.ceil(usersWithCount.count / size),
  };
};

const getUser = async (id) => {
  const user = await User.findOne({ where: { id: id, inactive: false }, attributes: ['id', 'username', 'email'] });
  if (!user) {
    throw new UserNotFondException();
  }
  return user;
};

const updateUser = async (id, body) => {
  const user = await User.findOne({ where: { id: id } });
  user.username = body.username;
  await user.save();
};

module.exports = { save, findByEmail, activate, getUsers, getUser, updateUser };
