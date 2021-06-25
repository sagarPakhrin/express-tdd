const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');

beforeAll(() => {
  return sequelize.sync();
});

beforeEach(() => {
  return User.destroy({ truncate: true });
});

const validUser = {
  username: 'user1',
  email: 'user1@mail.com',
  password: 'P4ssword',
};

const postUser = (user = validUser) => {
  return request(app).post('/api/1.0/users').send(user);
};

describe('User Registration', () => {
  it('should return 200 ok when signup request is valid', async () => {
    const response = await postUser();
    expect(response.statusCode).toBe(200);
  });

  it('should return success message with request is valid', async () => {
    const response = await postUser();
    expect(response.body.message).toBe('User Created');
  });

  it('should save the user to the database', async () => {
    await postUser();
    const userList = await User.findAll();
    expect(userList.length).toBe(1);
  });

  it('should save the username and password to the database', async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.username).toBe('user1');
    expect(savedUser.email).toBe('user1@mail.com');
  });

  it('should hash the password', async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.password).not.toBe('P4ssword');
  });

  it('should return 400 when username is not given', async () => {
    const response = await postUser({ ...validUser, username: null });
    expect(response.statusCode).toBe(400);
  });

  it('should return validationErrors field in reponse body when validation error occurs', async () => {
    const response = await postUser({ ...validUser, username: null });
    const body = response.body;
    expect(body.validationErrors).not.toBeUndefined();
  });

  it('should return errors for both when when email and username is null', async () => {
    const response = await postUser({ ...validUser, username: null, email: null });
    const body = response.body;
    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });

  // it.each([
  //   ['username', 'Username cannot be null'],
  //   ['email', 'E-mail cannot be null'],
  //   ['password', 'Password cannot be null'],
  // ])('when %s is null %s is received', async (field, expectedMessage) => {
  //   const user = {
  //     username: 'user1',
  //     email: 'user1@mail.com',
  //     password: 'P4ssword',
  //   };
  //   user[field] = null;
  //   const response = await postUser(user);
  //   const body = response.body;
  //   expect(body.validationErrors[field]).toBe(expectedMessage);
  // });

  it.each`
    field         | message
    ${'username'} | ${'Username cannot be null'}
    ${'email'}    | ${'E-mail cannot be null'}
    ${'password'} | ${'Password cannot be null'}
  `('should return $message when $field is null', async ({ field, message }) => {
    const user = {
      username: 'user1',
      email: 'user1@mail.com',
      password: 'P4ssword',
    };
    user[field] = null;
    const response = await postUser(user);
    const body = response.body;
    expect(body.validationErrors[field]).toBe(message);
  });
});
