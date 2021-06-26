const Token = require('../auth/Token');
const { randomString } = require('../shared/generator');

const createToken = async (user) => {
  const token = randomString(32);
  await Token.create({
    token: token,
    userId: user.id,
  });
  return token;
};

const verifyToken = async (token) => {
  const tokenInDb = await Token.findOne({ where: { token } });
  const userId = tokenInDb.userId;
  return { id: userId };
};

const tokenDelete = async (token) => {
  await Token.destroy({ where: { token: token } });
};

module.exports = { createToken, verifyToken, tokenDelete };
