const request = require('supertest');
const app = require('../src/app');
const bcrypt = require('bcrypt');
const sequelize = require('../src/config/database');
const User = require('../src/user/User');
const en = require('../locales/en/translation.json');
const np = require('../locales/np/translation.json');
const Token = require('../src/auth/Token');

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  return User.destroy({ truncate: true });
});
const activeUser = { username: 'user1', email: 'user1@mail.com', password: 'P4ssword', inactive: false };

const addUser = async (user = { ...activeUser }) => {
  const password = await bcrypt.hash('P4ssword', 10);
  user.password = password;
  await User.create(user);
};

const postAuth = async (credentials, options = {}) => {
  const agent = request(app).post('/api/1.0/auth');
  if (options.language) {
    agent.set('Accept-Language', options.language);
  }
  return agent.send(credentials);
};
const logout = (options = {}) => {
  const agent = request(app).post('/api/1.0/logout').send();
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }
  return agent;
};

describe('User Auth', () => {
  it('should return 200 ok when credentials are correct', async () => {
    await addUser();
    const res = await postAuth({ email: activeUser.email, password: 'P4ssword' });
    expect(res.status).toBe(200);
  });

  it('should return id, username, token when login is success', async () => {
    await addUser();
    const res = await postAuth({ email: activeUser.email, password: 'P4ssword' });
    expect(Object.keys(res.body)).toEqual(['id', 'username', 'token']);
  });

  it('should return 401 when user dosenot exist', async () => {
    const res = await postAuth({ email: 'user1@mail.com', password: 'P4ssword' });
    expect(res.status).toBe(401);
  });

  it('should return proper auth errors when auth fails', async () => {
    const nowInMillis = new Date().getTime();
    const res = await postAuth({ email: 'user1@mail.com', password: 'P4ssword' });
    const error = res.body;
    expect(error.path).toBe('/api/1.0/auth');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
  });

  it.each`
    language | message
    ${'en'}  | ${en.incorrect_credentials}
    ${'np'}  | ${np.incorrect_credentials}
  `('returns $message when language is $language', async ({ language, message }) => {
    const res = await postAuth({ email: activeUser.email, password: activeUser.password }, { language });
    expect(res.body.message).toBe(message);
  });

  it('should return proper auth errors when auth fails', async () => {
    await addUser();
    const res = await postAuth({ email: activeUser.email, password: 'sagar' });
    expect(res.status).toBe(401);
  });

  it('should return 403 when logging with inactive user', async () => {
    await addUser({ ...activeUser, inactive: true });
    const res = await postAuth({ email: activeUser.email, password: activeUser.password });
    expect(res.status).toBe(403);
  });

  it('should return proper error body when inactive user auth', async () => {
    await addUser({ ...activeUser, inactive: true });
    const nowInMillis = new Date().getTime();
    const res = await postAuth({ email: 'user1@mail.com', password: 'P4ssword' });
    const error = res.body;
    expect(error.path).toBe('/api/1.0/auth');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
  });

  it.each`
    language | message
    ${'en'}  | ${en.inactive_auth_failure}
    ${'np'}  | ${np.inactive_auth_failure}
  `('returns $message when language is $language', async ({ language, message }) => {
    await addUser({ ...activeUser, inactive: true });
    const res = await postAuth({ email: activeUser.email, password: activeUser.password }, { language });
    expect(res.body.message).toBe(message);
  });

  it('should return 401 when e-mail is invalid', async () => {
    const res = await postAuth({ password: 'P4ssword' });
    expect(res.status).toBe(401);
  });

  it('should return 401 when password is not valid', async () => {
    const res = await postAuth({ email: activeUser.email });
    expect(res.status).toBe(401);
  });

  it('should return token in response body when credentials are correct', async () => {
    await addUser();
    const res = await postAuth({ email: activeUser.email, password: 'P4ssword' });
    expect(res.body.token).not.toBeUndefined();
  });
});

describe('Logout', () => {
  it('should return 200 ok when unauthorized request send for logout', async () => {
    const response = await logout();
    expect(response.status).toBe(200);
  });
  it('should remove the tokne from the database', async () => {
    await addUser();
    const response = await postAuth({ email: activeUser.email, password: 'P4ssword' });
    const token = response.body.token;
    await logout({ token: token });
    const storedToken = await Token.findOne({ where: { token: token } });
    expect(storedToken).toBeNull();
  });
});
