import request from 'supertest';
import app from '../../app';

describe('Public Routes', () => {
  it('GET /api/v1/public/config should return the application name', async () => {
    const res = await request(app).get('/api/v1/public/config');
    
    // Check if the response is successful
    expect(res.status).toBe(200);
    
    // Check the response structure
    expect(res.body).toHaveProperty('status', 'success');
    expect(res.body.data).toHaveProperty('app_name');
    
    // The specific app_name might vary depending on database state,
    // so we just check it exists and is a string.
    expect(typeof res.body.data.app_name).toBe('string');
  });
});
