import axios from 'axios';
import https from 'https';
import 'dotenv/config';

// Create dynamic axios client for specific router
export const createMikrotikClient = (routerConfig) => {
  const { ipAddress, api_username, api_password } = routerConfig;

  // Build base URL from IP address
  const rawBaseUrl = `https://${ipAddress}`;
  const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, '');
  const restBaseUrl = normalizedBaseUrl.endsWith('/rest')
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/rest`;

  return axios.create({
    baseURL: restBaseUrl,
    auth: {
      username: api_username,
      password: api_password
    },
    // Only use HTTPS agent if URL starts with https
    ...(restBaseUrl.startsWith('https') && {
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    }),
    timeout: 5000
  });
};

// Get all users from specific router
export const getUsers = async (routerConfig) => {
  const client = createMikrotikClient(routerConfig);
  try {
    const response = await client.get('/ip/hotspot/user');
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Error fetching users from Mikrotik:', {
        status: error.response.status,
        data: error.response.data
      });
    } else {
      console.error('Error fetching users from Mikrotik:', error.message);
    }
    throw error;
  }
};

// Create a new user on specific router
export const createuser = async (routerConfig, name, password, profile = 'default') => {
  const client = createMikrotikClient(routerConfig);
  try {
    const response = await client.post(
      '/ip/hotspot/user/add',
      {
        name,
        password,
        profile: profile || 'default'
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating user in Mikrotik:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      config: {
        url: error.config?.baseURL + error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      }
    });
    throw error;
  }
};

//create many users on specific router
export const createManyUsers = async (routerConfig, users) => {
  const client = createMikrotikClient(routerConfig);
  try {
    const response = await client.post('/ip/hotspot/user/add', users);
    return response.data;
  } catch (error) {
    console.error('Error creating multiple users in Mikrotik:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      config: {
        url: error.config?.baseURL + error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      }
    });
    throw error;
  }
};

// Get hotspot status from specific router
export const getHotspotStatus = async (routerConfig) => {
  const client = createMikrotikClient(routerConfig);
  try {
    const response = await client.get('/ip/hotspot/status');
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Error fetching hotspot status from Mikrotik:', {
        status: error.response.status,
        data: error.response.data
      });
    } else {
      console.error('Error fetching hotspot status from Mikrotik:', error.message);
    }
    throw error;
  } 
};

  //update hotspot user on specific router
  export const updateUser = async (routerConfig, username, updates) => {
    const client = createMikrotikClient(routerConfig);
    try {
      const response = await client.put(`/ip/hotspot/user/${username}`, updates);
      return response.data;
    } catch (error) {
      if (error.response) {
        console.error('Error updating user in Mikrotik:', {
          status: error.response.status,
          data: error.response.data
        });
      } else {
        console.error('Error updating user in Mikrotik:', error.message);
      }
      throw error;
    }
  };

// Get hotspot user by username from specific router
export const getUserByUsername = async (routerConfig, username) => {
  const client = createMikrotikClient(routerConfig);
  try {
    const response = await client.get(`/ip/hotspot/user/${username}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Error fetching user from Mikrotik:', {
        status: error.response.status,
        data: error.response.data
      });
    } else {
      console.error('Error fetching user from Mikrotik:', error.message);
    }
    throw error;
  }
};

// Get hotspot user by ID from specific router
export const getUserById = async (routerConfig, id) => {
  const client = createMikrotikClient(routerConfig);
  try {
    const response = await client.get(`/ip/hotspot/user/${id}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Error fetching user from Mikrotik:', {
        status: error.response.status,
        data: error.response.data
      });
    } else {
      console.error('Error fetching user from Mikrotik:', error.message);
    }
    throw error;
  }
};

// delete many users from specific router
export const deleteManyUsers = async (routerConfig, usernames) => {
  const client = createMikrotikClient(routerConfig);
  try {
    const deletePromises = usernames.map(username =>
      client.delete(`/ip/hotspot/user/${username}`)
    );
    const responses = await Promise.all(deletePromises);
    return responses.map(res => res.data);
  } catch (error) {
    console.error('Error deleting multiple users from Mikrotik:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      config: {
        url: error.config?.baseURL + error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      }
    });
    throw error;
  }
};

// Delete a user from specific router
export const deleteUser = async (routerConfig, username) => {
  const client = createMikrotikClient(routerConfig);
  try {
    const response = await client.delete(`/ip/hotspot/user/${username}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Error deleting user from Mikrotik:', {
        status: error.response.status,
        data: error.response.data
      });
    } else {
      console.error('Error deleting user from Mikrotik:', error.message);
    }
    throw error;
  }
};

// Get hotspot profiles from specific router
export const getProfiles = async (routerConfig) => {
  const client = createMikrotikClient(routerConfig);
  try {
    const response = await client.get('/ip/hotspot/profile');
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Error fetching profiles from Mikrotik:', {
        status: error.response.status,
        data: error.response.data
      });
    } else {
      console.error('Error fetching profiles from Mikrotik:', error.message);
    }
    throw error;
  }
};
