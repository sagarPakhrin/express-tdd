const request = require('supertest');
const app = require('../src/app');
const bcrypt = require('bcrypt');
const sequelize = require('../src/config/database');
const User = require('../src/user/User');
const en = require('../locales/en/translation.json');
const np = require('../locales/np/translation.json');

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
  return User.create(user);
};

const putUser = async (id = 5, body = null, options = {}) => {
  let agent = request(app);
  let token;
  if (options.auth) {
    const response = await agent.post('/api/1.0/auth').send(options.auth);
    token = response.body.token;
  }
  agent = request(app).put(`/api/1.0/users/${id}`);
  if (options.language) {
    agent.set('Accept-Language', options.language);
  }
  if (token) {
    agent.set('Authorization', `Bearer ${token}`);
  }
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }
  return agent.send(body);
};

describe('User Update', () => {
  it('should return forbidden when request sent without basic authentication', async () => {
    const response = await request(app).put('/api/1.0/users/5').send();
    expect(response.status).toBe(403);
  });

  it.each`
    language | message
    ${'en'}  | ${en.unauthorized_user_update}
    ${'np'}  | ${np.unauthorized_user_update}
  `('should return $message when unauthorized and language is $language', async ({ language, message }) => {
    const nowInMillies = new Date().getTime();
    const res = await putUser(5, null, { language });
    expect(res.body.path).toBe('/api/1.0/users/5');
    expect(res.body.timestamp).toBeGreaterThan(nowInMillies);
    expect(res.body.message).toBe(message);
  });

  it('should return forbidden when request sent with incorrect email in basic auth', async () => {
    await addUser();
    const res = await putUser(5, null, { auth: { email: 'user1000@mail.com', password: 'P4ssword' } });
    expect(res.status).toBe(403);
  });

  it('should return forbidden when request sent with incorrect password', async () => {
    await addUser();
    const res = await putUser(5, null, { auth: { email: 'user1@mail.com', password: 'Pssword' } });
    expect(res.status).toBe(403);
  });

  it('should return forbidden when request sent with correct credentials but for different user', async () => {
    await addUser();
    const userToBeUpdate = await addUser({ ...activeUser, username: 'user2', email: 'user2@mail.com' });
    const res = await putUser(userToBeUpdate.id, null, { auth: { email: 'user1@mail.com', password: 'P4ssword' } });
    expect(res.status).toBe(403);
  });

  it('should return forbidden when update user is sent by inactive user correct credentails for own user', async () => {
    const inactiveUser = await addUser({ ...activeUser, inactive: true });
    const res = await putUser(inactiveUser.id, null, { auth: { email: 'user1@mail.com', password: 'P4ssword' } });
    expect(res.status).toBe(403);
  });

  it('should return 200 ok when valid upate request sent from authorized user', async () => {
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated' };
    const res = await putUser(savedUser.id, validUpdate, { auth: { email: savedUser.email, password: 'P4ssword' } });
    expect(res.status).toBe(200);
  });

  it('should update the username in database when valid requets is sent from authorized user', async () => {
    const savedUser = await addUser();
    const validUpdate = { username: 'user1-updated' };
    await putUser(savedUser.id, validUpdate, { auth: { email: savedUser.email, password: 'P4ssword' } });
    const inDBUser = await User.findOne({ where: { id: savedUser.id } });
    expect(inDBUser.username).toBe(validUpdate.username);
  });

  it('should return 403 when token is not valid', async () => {
    const response = await putUser(5, null, { token: '123' });
    expect(response.status).toBe(403);
  });
});
