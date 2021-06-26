const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const nodemailerStub = require('nodemailer-stub');
const EmailService = require('../src/email/EmailService');

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

const postUser = (user = validUser, options = {}) => {
  const agent = request(app).post('/api/1.0/users');
  if (options.language) {
    agent.set('Accept-Language', options.language);
  }
  return agent.send(user);
};

describe('User Registration', () => {
  const username_null = 'Username cannot be null';
  const username_size = 'Must have min 4 and max 32 characters';
  const email_null = 'E-mail cannot be null';
  const email_invalid = 'E-mail is not valid';
  const password_null = 'Password cannot be null';
  const password_size = 'Password must be at least 6 characters long';
  const password_pattern = 'Password must have at least 1 upsercase, 1 losercase and 1 number';
  const email_inuse = 'E-mail in use';
  const user_create_success = 'User created';

  it('should return 200 ok when signup request is valid', async () => {
    const response = await postUser();
    expect(response.statusCode).toBe(200);
  });

  it('should return success message with request is valid', async () => {
    const response = await postUser();
    expect(response.body.message).toBe(user_create_success);
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

  it.each`
    field         | value              | message
    ${'username'} | ${null}            | ${username_null}
    ${'username'} | ${'usr'}           | ${username_size}
    ${'username'} | ${'a'.repeat(33)}  | ${username_size}
    ${'email'}    | ${null}            | ${email_null}
    ${'email'}    | ${'mail.com'}      | ${email_invalid}
    ${'email'}    | ${'user.mail.com'} | ${email_invalid}
    ${'email'}    | ${'user@com'}      | ${email_invalid}
    ${'password'} | ${null}            | ${password_null}
    ${'password'} | ${'P4ssw'}         | ${password_size}
    ${'password'} | ${'alllowercase'}  | ${password_pattern}
    ${'password'} | ${'ALLUPPERCASE'}  | ${password_pattern}
    ${'password'} | ${'123456779'}     | ${password_pattern}
    ${'password'} | ${'lowerandUPPER'} | ${password_pattern}
    ${'password'} | ${'lower12321'}    | ${password_pattern}
    ${'password'} | ${'UPPER12321'}    | ${password_pattern}
  `('should return $message when $field is $value', async ({ field, value, message }) => {
    const user = { ...validUser };
    user[field] = value;
    const response = await postUser(user);
    const body = response.body;
    expect(body.validationErrors[field]).toBe(message);
  });

  it('should return E-mail in use when same email is already in use', async () => {
    await User.create({ ...validUser });
    const response = await postUser();
    expect(response.body.validationErrors.email).toBe(email_inuse);
  });

  it('should return errors for both usernam is null and E-mail in use', async () => {
    await User.create({ ...validUser });
    const response = await postUser({ ...validUser, username: null });
    expect(Object.keys(response.body.validationErrors)).toEqual(['username', 'email']);
  });

  it('should create user in inactive mode', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it('should create user in inactive mode even if body has inactive set to false', async () => {
    await postUser({ ...validUser, inactive: false });
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it('should create token for user', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.activationToken).toBeTruthy();
  });

  it('should send account activateion email with activationToken', async () => {
    await postUser({ ...validUser, inactive: false });
    const users = await User.findAll();
    const savedUser = users[0];
    const lastMail = nodemailerStub.interactsWithMail.lastMail();
    expect(lastMail.to[0]).toBe(validUser.email);
    expect(lastMail.content).toContain(savedUser.activationToken);
  });

  it('should send 502 Bad Gateway when sending email fails', async () => {
    const mockSendActivation = jest
      .spyOn(EmailService, 'sendAccountActivation')
      .mockRejectedValue({ message: 'Failed to deliver email' });
    const response = await postUser();
    expect(response.status).toBe(502);
    mockSendActivation.mockRestore();
  });

  it('should Email failure message when sending email fails', async () => {
    const mockSendActivation = jest
      .spyOn(EmailService, 'sendAccountActivation')
      .mockRejectedValue({ message: 'E-mail Failure' });
    const response = await postUser();
    mockSendActivation.mockRestore();
    expect(response.body.message).toBe('E-mail Failure');
  });

  it('should not save user in databse when email fails', async () => {
    const mockSendActivation = jest
      .spyOn(EmailService, 'sendAccountActivation')
      .mockRejectedValue({ message: 'E-mail Failure' });
    await postUser();
    mockSendActivation.mockRestore();
    const users = await User.findAll();
    expect(users.length).toBe(0);
  });
});

describe('Internalization', () => {
  const username_null = 'प्रयोगकर्ता नाम खाली हुन सक्दैन';
  const username_size = 'न्यूनतम दुई र अधिकतम बत्तिस क्यारेक्टर हुनै पर्दछ';
  const email_null = 'इ-मेल खाली हुन सक्दैन';
  const email_invalid = 'इ-मेल मान्य छैन';
  const password_null = 'पासवर्ड खाली हुन सक्दैन';
  const password_size = 'पासवर्ड कम्तिमा 6 अक्षरको हुनु पर्दछ';
  const password_pattern = 'पासवर्ड कम्तिमा १ अपसेरकेस, १ लॉजरकेस र १ नम्बर हुनुपर्दछ';
  const email_inuse = 'प्रयोगमा इ-मेल';
  const user_create_success = 'प्रयोगकर्ता सिर्जना गरियो';
  const email_failure = 'ईमेल असफलता';

  it.each`
    field         | value              | message
    ${'username'} | ${null}            | ${username_null}
    ${'username'} | ${'usr'}           | ${username_size}
    ${'username'} | ${'a'.repeat(33)}  | ${username_size}
    ${'email'}    | ${null}            | ${email_null}
    ${'email'}    | ${'mail.com'}      | ${email_invalid}
    ${'email'}    | ${'user.mail.com'} | ${email_invalid}
    ${'email'}    | ${'user@com'}      | ${email_invalid}
    ${'password'} | ${null}            | ${password_null}
    ${'password'} | ${'P4ssw'}         | ${password_size}
    ${'password'} | ${'alllowercase'}  | ${password_pattern}
    ${'password'} | ${'ALLUPPERCASE'}  | ${password_pattern}
    ${'password'} | ${'123456779'}     | ${password_pattern}
    ${'password'} | ${'lowerandUPPER'} | ${password_pattern}
    ${'password'} | ${'lower12321'}    | ${password_pattern}
    ${'password'} | ${'UPPER12321'}    | ${password_pattern}
  `('should return $message when $field is $value', async ({ field, value, message }) => {
    const user = { ...validUser };
    user[field] = value;
    const response = await postUser(user, { language: 'np' });
    const body = response.body;
    expect(body.validationErrors[field]).toBe(message);
  });

  it(`should return ${email_inuse} when same email is already in use`, async () => {
    await User.create({ ...validUser });
    const response = await postUser(
      { ...validUser },
      {
        language: 'np',
      }
    );
    expect(response.body.validationErrors.email).toBe(email_inuse);
  });

  it(`should return success message of ${user_create_success} when requets is valid and language set to np`, async () => {
    const response = await postUser({ ...validUser }, { language: 'np' });
    expect(response.body.message).toBe(user_create_success);
  });

  it('should Email failure message when sending email fails', async () => {
    const mockSendActivation = jest
      .spyOn(EmailService, 'sendAccountActivation')
      .mockRejectedValue({ message: 'E-mail Failure' });
    const response = await postUser({ ...validUser }, { language: 'np' });
    mockSendActivation.mockRestore();
    expect(response.body.message).toBe(email_failure);
  });
});
