import app from './server.js';
import connectToDatabase from './databaseConfig.js';
import { getAllUsers,getUserByName,createUser, initializeDb as initMongoServicesDb } from './mongoServices/mogodbServices.js';
import { createRouter, initializeDb as initRouterServicesDb } from './mongoServices/routerServices.js';
import { initializeAuthMiddleware } from './middleware/auth_middleware.js';
import 'dotenv/config';

const PORT = process.env.PORT || 5000;

// Initialize database connection when server starts
try {
  const db = await connectToDatabase();
  console.log('Database connected successfully');

  // Initialize services with the shared db instance
  initMongoServicesDb(db);
  initRouterServicesDb(db);
  initializeAuthMiddleware(db);

  // Start server after database is connected
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

} catch (error) {
  console.error('Failed to connect to database:', error);
  process.exit(1);
}



//create user in database
       try {
      const response = await createUser({ 
        password: "ssewante",
        firstName: "Test2",
        lastName: "User3",
        email: "seegostone@gmail.com"
      });
      console.log('User created in Database:', response);
    } catch (error) {
      console.error('Error creating user in Database:', error.message);
    }

    try {
      const routerResponse = await createRouter({
        userId: "69e220aa0334efefd628c82f",
        name: 'stone25',
        hotspotName: 'stone25',
        ipAddress: '192.168.1.1',
        api_password: 'ssewante',
        api_username: 'admin'
        
      });
      console.log('Router created:', routerResponse);
    }catch (error) {
      console.error('Error creating router:', error.message);
    }




// Test database connection by fetching all users
/*try {
  const users = await getAllUsers(1234);
  const usersWithId = users.map(user => ({
    ...user,
    id: user._id
  }))
  console.log('Users in database:', usersWithId);
} catch (error) {
  console.error('Error fetching users from database:', error);
};

try {
      const user = await getUserByName('jm26');
      console.log('User fetched by name:', user);
    } catch (error) {
      console.error('Error fetching user by name:', error);
     
    }
    try {
      const response = await createDbUser({ 
        name: "testuser",
        password: "test123",
        profile: "1hour",
        routerId: 1234
      });
      console.log('User created in Database:', response.voucher);
    } catch (error) {
      console.error('Error creating user in Database:', error.message);
    }






    */

