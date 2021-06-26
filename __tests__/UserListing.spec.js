const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const User = require('../src/user/User');

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  return User.destroy({ truncate: true });
});

const getUsers = () => {
  return request(app).get('/api/1.0/users');
};
const addUsers = async (activeCount = 11, inactiveCount = 0) => {
  for (let i = 0; i < activeCount + inactiveCount; i++) {
    await User.create({
      username: `user${i + 1}`,
      email: `user${i + 1}@mail.com`,
      inactive: i >= activeCount,
    });
  }
};

describe('User Listing', () => {
  it('should return 200 ok when there is not users in database', async () => {
    const response = await getUsers();
    expect(response.status).toBe(200);
  });

  it('should return page object in response body', async () => {
    const response = await getUsers();
    expect(response.body).toEqual({
      items: [],
      page: 0,
      size: 10,
      totalPages: 0,
    });
  });

  it('should return 10 users in page content when there are 11 users in database', async () => {
    await addUsers();
    const response = await getUsers();
    expect(response.body.items.length).toBe(10);
  });

  it('should return 6 users in page content when there are 6 active and 5 inactive users in database', async () => {
    await addUsers(6, 5);
    const response = await getUsers();
    expect(response.body.items.length).toBe(6);
  });

  it('should only return id, username, email in content array', async () => {
    await addUsers();
    const response = await getUsers();
    const user = response.body.items[0];
    expect(Object.keys(user)).toEqual(['id', 'username', 'email']);
  });
});
