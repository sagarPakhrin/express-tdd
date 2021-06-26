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

  it('should return 2 as totalPages when there are 5 active users and 7 inactive users', async () => {
    await addUsers(15, 7);
    const response = await getUsers();
    expect(response.body.totalPages).toBe(2);
  });

  it('should return second page users and page indicator when page is set as 1', async () => {
    await addUsers();
    const response = await getUsers().query({ page: 1 });
    expect(response.body.items[0].username).toBe('user11');
    expect(response.body.page).toBe(1);
  });

  it('should return first page when page is below 0', async () => {
    await addUsers();
    const response = await getUsers().query({ page: -1 });
    expect(response.body.page).toBe(0);
  });

  it('should return 5 users and corresponding indicator when size is set to 5', async () => {
    await addUsers();
    const response = await getUsers().query({ size: 5 });
    expect(response.body.items.length).toBe(5);
    expect(response.body.size).toBe(5);
  });

  it('should return 10 users and corresponding indicator when size is set to 1000', async () => {
    await addUsers();
    const response = await getUsers().query({ size: 1000 });
    expect(response.body.items.length).toBe(10);
    expect(response.body.size).toBe(10);
  });

  it('should return 10 users and corresponding indicator when size is less than 0', async () => {
    await addUsers();
    const response = await getUsers().query({ size: -2 });
    expect(response.body.items.length).toBe(10);
    expect(response.body.size).toBe(10);
  });

  it('should return 10 users and corresponding indicator when size is 0', async () => {
    await addUsers();
    const response = await getUsers().query({ size: 0 });
    expect(response.body.items.length).toBe(10);
    expect(response.body.size).toBe(10);
  });
});

describe('User Listing', () => {
  const getUser = (id = 5) => {
    return request(app).get(`/api/1.0/users/${id}`);
  };
  it('should return 404 when user is not found', async () => {
    const response = await getUser();
    expect(response.status).toBe(404);
  });

  it.each`
    language | message
    ${'en'}  | ${'User not found'}
    ${'np'}  | ${'प्रयोगकर्ता फेला परेन'}
  `(`should return $message for unknown user when language is set to $language`, async ({ language, message }) => {
    const response = await getUser().set('Accept-Language', language);
    expect(response.body.message).toBe(message);
  });

  it('should return proper resonse body when user not found', async () => {
    const nowInMillies = new Date().getTime();
    const response = await getUser();
    const error = response.body;
    expect(error.path).toBe('/api/1.0/users/5');
    expect(error.timestamp).toBeGreaterThan(nowInMillies);
    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
  });

  it('should return 200 ok when user is found', async () => {
    const user = await User.create({
      username: 'user1',
      email: 'user1@mail.com',
      inactive: false,
    });
    const response = await getUser(user.id);
    expect(response.status).toBe(200);
  });

  it('should return id, username, email in response body', async () => {
    const user = await User.create({
      username: 'user1',
      email: 'user1@mail.com',
      inactive: false,
    });
    const response = await getUser(user.id);
    expect(Object.keys(response.body)).toEqual(['id', 'username', 'email']);
  });

  it('should return 404 when user is inactive', async () => {
    const user = await User.create({
      username: 'user1',
      email: 'user1@mail.com',
      inactive: true,
    });
    const response = await getUser(user.id);
    expect(response.status).toBe(404);
  });
});
