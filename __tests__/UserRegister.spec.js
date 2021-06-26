const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const { SMTPServer } = require('smtp-server');

let lastMail, server;
let simulateSmtpFailure = false;
beforeAll(async () => {
  server = new SMTPServer({
    authOptional: true,
    onData(stream, session, callback) {
      let mailBody;
      stream.on('data', (data) => {
        mailBody += data.toString();
      });
      stream.on('end', () => {
        if (simulateSmtpFailure) {
          const err = new Error('Invalid mailbox');
          err.responseCode = 553;
          return callback(err);
        }

        lastMail = mailBody;
        callback();
      });
    },
  });

  server.listen(8587, 'localhost');
  await sequelize.sync();
});

beforeEach(() => {
  simulateSmtpFailure = false;
  return User.destroy({ truncate: true });
});

afterAll(async () => {
  await server.close();
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

  it('should send account activation email with activationToken', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(lastMail).toContain(validUser.email);
    expect(lastMail).toContain(savedUser.activationToken);
  });

  it('should send 502 Bad Gateway when sending email fails', async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.status).toBe(502);
  });

  it('should Email failure message when sending email fails', async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.body.message).toBe('E-mail Failure');
  });

  it('should not save user in databse when email fails', async () => {
    simulateSmtpFailure = true;
    await postUser();
    const users = await User.findAll();
    expect(users.length).toBe(0);
  });

  it('should return Validation Failure message in error reponse body when validation fails', async () => {
    const response = await postUser({ ...validUser, email: null });
    expect(response.body.message).toBe('Validation Failure');
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
  const validation_failure = 'प्रमाणीकरण विफलता';

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
    simulateSmtpFailure = true;
    const response = await postUser({ ...validUser }, { language: 'np' });
    expect(response.body.message).toBe(email_failure);
  });

  it(`should return ${validation_failure} message in error reponse body when validation fails`, async () => {
    const response = await postUser({ ...validUser, email: null }, { language: 'np' });
    expect(response.body.message).toBe(validation_failure);
  });
});

describe('Account Activate,', () => {
  it('should activate account when correct token is sent', async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    users = await User.findAll();
    expect(users[0].inactive).toBe(false);
  });

  it('should remove activationToken after successful activation', async () => {
    await postUser();
    const token = 'this token doesnot exist';

    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    let users = await User.findAll();
    expect(users[0].inactive).toBe(true);
  });

  it('should not actiavte account when token is wrong', async () => {
    await postUser();
    const token = 'token-doesnot-exist';
    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    const users = await User.findAll();
    expect(users[0].inactive).toBe(true);
  });

  it('should return bad request when token is wrong', async () => {
    await postUser();
    const token = 'token-doesnot-exist';
    const response = await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    expect(response.status).toBe(400);
  });

  it.each`
    language | tokenStatus  | message
    ${'np'}  | ${'wrong'}   | ${'यो खाता या त सक्रिय छ वा टोकन अवैध छ'}
    ${'en'}  | ${'wrong'}   | ${'This account is either active or token is invalid'}
    ${'np'}  | ${'correct'} | ${'खाता सक्रिय गरिएको छ'}
    ${'en'}  | ${'correct'} | ${'Account is activated'}
  `(
    'should return $message when token is $tokenStatus and langage is $language',
    async ({ language, tokenStatus, message }) => {
      await postUser();
      let token = 'token-doesnot-exist';
      if (tokenStatus === 'correct') {
        let users = await User.findAll();
        token = users[0].activationToken;
      }
      const response = await request(app)
        .post('/api/1.0/users/token/' + token)
        .set('Accept-Language', language)
        .send();
      expect(response.body.message).toBe(message);
    }
  );
});

describe('Error Model', () => {
  it('should return path, timestamp, message in response', async () => {
    const response = await postUser({ ...validUser, email: null });
    const { body } = response;
    expect(Object.keys(body)).toEqual(['path', 'timestamp', 'message', 'validationErrors']);
  });

  it('should return path, timestamp, message and validationErrors in response validation Failure occures ', async () => {
    const response = await request(app)
      .post('/api/1.0/users/token/' + 'this-tokne-doesnot-exist')
      .send();
    const { body } = response;
    expect(Object.keys(body)).toEqual(['path', 'timestamp', 'message']);
  });

  it('should return path in error body', async () => {
    const response = await postUser({ ...validUser, email: null });
    const { body } = response;
    expect(body.path).toEqual('/api/1.0/users');
  });

  it('should return timestamp in milliseconds', async () => {
    const nowInMillies = new Date().getTime();
    const fiveSecondsLater = nowInMillies + 5 * 1000;
    const response = await postUser({ ...validUser, email: null });
    const { body } = response;
    expect(body.timestamp).toBeGreaterThan(nowInMillies);
    expect(body.timestamp).toBeLessThan(fiveSecondsLater);
  });
});
