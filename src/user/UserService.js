const bcrypt = require('bcrypt');
const User = require('./User');

const save = async (body) => {
  const hash = await bcrypt.hash(body.password, 10);
  const user = { ...body, password: hash };
  await User.create(user);
};

const findByEmail = async (email) => {
  return await User.findOne({ where: { email } });
};

module.exports = { save, findByEmail };
