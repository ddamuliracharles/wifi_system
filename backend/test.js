// test-mikrotik.js
import axios from 'axios';

async function testDirect() {
  try {
    console.log('Testing direct connection to MikroTik...');
    
    const response = await axios.post(
      'http://192.168.88.1/rest/ip/hotspot/user/add',
      {
        name: 'testdirect',
        password: 'test123',
        profile: 'default'
      },
      {
        auth: {
          username: 'admin',
          password: 'admin1234'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Direct test successful:', response.data);
  } catch (error) {
    console.error('❌ Direct test failed:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
  }
}

testDirect();