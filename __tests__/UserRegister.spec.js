const request = require('supertest');
const app = require('../app');

it('returns 200 ok when signup request is valid', () => {
  request(app)
    .post('/api/1.0/user')
    .send({
      username: 'user1',
      email: 'user1@mail.com',
      password: 'P4ssword',
    })
    .expect(200);
});
