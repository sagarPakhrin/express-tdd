const request = require('supertest');
const app = require('../src/app');

describe('User Listing', () => {
  it('should return 200 ok when there is not users in database', async () => {
    const response = await request(app).get('/api/1.0/users');
    expect(response.status).toBe(200);
  });

  it('should return page object in response body', async () => {
    const response = await request(app).get('/api/1.0/users');
    expect(response.body).toEqual({
      items: [],
      page: 0,
      size: 10,
      totalPages: 0,
    });
  });
});
