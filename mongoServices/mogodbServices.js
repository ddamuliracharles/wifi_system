import { type } from 'node:os';
import { MongoError } from 'mongodb';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import jwt from 'jsonwebtoken';

// Remove top-level db connection - will be passed in
let db = null;
const collection = 'users'; // Replace with your collection name

// Initialize function to set the db instance
export const initializeDb = (dbInstance) => {
  db = dbInstance;
};

// Get all users
  export const getAllUsers = async (router_Id) => {
  try {
    const response = await db.collection(collection).find({'relatedTo':router_Id,'type':'voucher'}).toArray();
    return response;

  } catch (error) {
    console.error('Error fetching users from MongoDB:', error.message);
     if (error instanceof MongoError) {
      console.error('MongoDB Error Details:', {
        code: error.code,
        name: error.name,
        message: error.message,
        stack: error.stack
      });   
    }
    throw error;
  } 
};

// Get a user by name
export const getUserByName = async (dname) => {
  try {
    const response = await db.collection(collection).findOne({ name: dname }); 
    return response;
  } catch (error) {    console.error(`Error fetching user ${dname} from MongoDB:`, error.message);
     if (error instanceof MongoError) {
      console.error('MongoDB Error Details:', {
        code: error.code,
        name: error.name,
        message: error.message,
        stack: error.stack
        });
    }
    throw error;
  }
};

// Create a user (voucher) - with profile data and router reference
export const createHotspotUser = async (userData) => {
  try {
    
    // 1. Get router ID from request body (sent from frontend localStorage)
    const routerId = userData.routerId;
    
    if (!routerId) {
      throw new Error('Router ID is required. Make sure a router is selected.');
    }
    
    // 3. Get profile for this router
    const profile = await db.collection(collection).findOne({
      type: "profile",
      name: userData.profile,
      relatedTo: routerId
    });
    
    if (!profile) {
      throw new Error(`Profile "${userData.profile}" not found for this router`);
    }
    
    // 4. Generate comment if not provided
    const generateComment = (profileName) => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString().replace(/:/g, '.');
      const dateStr = now.toLocaleDateString().replace(/\//g, '/');
      return `vc-912-${timeStr}-${profileName}${dateStr}`;
    };
    
    // 5. Create voucher
    const voucher = {
      type: "voucher",
      name: userData.name,
      password: userData.password,
      profile: userData.profile,
      
      // Denormalized profile data
      profileData: {
        durationHours: profile.durationHours,
        rateLimit: profile.rateLimit,
        price: profile.price,
        profileId: profile._id
      },
      
      // Router reference (from localStorage)
      relatedTo: [routerId],
      
      // Status
      status: "active",
      "first-loginAt": null,
      expiresAt: null,
      
      // Optional fields
      ...(userData["limit-uptime"] && { "limit-uptime": userData["limit-uptime"] }),
      comment: userData.comment || generateComment(userData.profile),
      
      // Simple usage tracking
      usage: {
        timesUsed: 0,
        totalMinutes: 0,
        totalBytes: 0,
        firstUsed: null,
        lastUsed: null,
        devices: []
      },
      
      // Metadata
      createdBy: authenticatedUser?.id||"system",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection(collection).insertOne(voucher);
    
    return( {
      success: true,
      message: 'Voucher created successfully',
      voucher: {
        _id: result.insertedId,
        name: voucher.name,
        profile: voucher.profile,
        status: voucher.status,
        comment: voucher.comment,
        createdAt: voucher.createdAt,
        routerId: routerId
      }
    }
  )
    
  } catch (error) {
    console.error('Error creating voucher:', error);
    throw error;
  }
};


// Create many users
export const createManyUsers = async (users) => {
  try {
    const response = await db.collection(collection).insertMany(users);
    return response;
    } catch (error) {
    console.error('Error creating multiple users in MongoDB:', error.message);
     if (error instanceof MongoError) {
      console.error('MongoDB Error Details:', {
        code: error.code,
        name: error.name,
        message: error.message,
        stack: error.stack
        });
    }   throw error;
    }   
};

// Update a user by name
export const updateUserByName = async (name,update) => {
  try {
    const response = await db.collection(collection).updateOne  
    ({ type: "voucher", name, relatedTo: update.router_Id }, { $set: update });
    return response;
  } catch (error) {    console.error(`Error updating voucher ${name} in MongoDB:`, error.message);
     if (error instanceof MongoError) {
      console.error('MongoDB Error Details:', {
        code: error.code,
        name: error.name,
        message: error.message, 
        stack: error.stack
        });
    }
    throw error;
  }
};




// login user (for admin login to web UI) - returns JWT token on success
export const loginUser = async (email, password) => {
  try {

    const usersCollection = db.collection('users'); // Replace with your actual collection name
    
    // Find user by email
    const user = await usersCollection.findOne({ email });
    
    // Check if user exists - throw error instead of using res
    if (!user) {
      const error = new Error('Invalid email');
      error.status = 401;
      throw error;
    }
    
    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      const error = new Error('Invalid credentials');
      error.status = 401;
      throw error;
    }
    
    // Get user ID as string
    const userId = user._id.toString();
    
    // Create JWT token
    const token = jwt.sign(
      { 
        userId: userId,
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Return success data (NO res object used!)
    return { 
      success: true, 
      token,
      user: {
        id: userId,
        email: user.email,
        name: user.name
      }
    };
    
  } catch (error) {
    console.error('Error logging in user:', error.message);
    
    // Add status to error if not present
    if (!error.status) {
      error.status = 500;
    }
    
    // Re-throw for the route handler to catch
    throw error;
  }
};






// Delete a user by name
export const deleteUserByName = async (name, routerId) => {
  try {
    const response = await db.collection(collection).deleteOne({ type: "voucher", name: name, relatedTo: routerId });   
    return response;
  } catch (error) {    console.error(`Error deleting user ${name} from MongoDB:`, error.message);
     if (error instanceof MongoError) {
      console.error('MongoDB Error Details:', {
        code: error.code,
        name: error.name,
        message: error.message,
        stack: error.stack
        });
    }   throw error;
    } 
};


//create many db users with same profile and router reference (optimized for bulk creation in frontend) - expects array of user data with routerId and profile name included in each item, but will only fetch profile once for efficiency
export const createManyDbUsers = async (vouchersData, authenticatedUser) => {
  try {
    // 1. Get router ID from the first voucher
    const routerId = vouchersData[0]?.routerId;
    
    if (!routerId) {
      throw new Error('Router ID is required. Make sure a router is selected.');
    }

        // 2. Verify this user actually owns this router
   /* const router = await collection.findOne({
      type: "router",
      router_Id: routerId,
      relatedTo: authenticatedUser.id // User ID from JWT
    });
    
    if (!router) {
      throw new Error(`Router ${routerId} not found or you don't have permission`);
    }*/
    
    // 2. Get the profile name from the first voucher (all same profile)
    const profileName = vouchersData[0]?.profile;
    
    if (!profileName) {
      throw new Error('Profile name is required');
    }
    
    // 3. Get the profile ONCE (since all vouchers use same profile)
    const profile = await db.collection(collection).findOne({
      type: "profile",
      name: profileName,
      relatedTo: routerId
    });
    
    if (!profile) {
      throw new Error(`Profile "${profileName}" not found for this router`);
    }
    
    // 4. Generate comment helper (same as original)
    const generateComment = (profileName) => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString().replace(/:/g, '.');
      const dateStr = now.toLocaleDateString().replace(/\//g, '/');
      return `vc-912-${timeStr}-${profileName}${dateStr}`;
    };
    
    // 5. Create ALL vouchers using the SAME profile
    const vouchers = vouchersData.map((userData) => {
      return {
        type: "voucher",
        name: userData.name,
        password: userData.password,
        profile: profileName,  // Same profile for all
        
        // Denormalized profile data (same for all)
        profileData: {
          durationHours: profile.durationHours,
          rateLimit: profile.rateLimit,
          price: profile.price,
          profileId: profile._id
        },
        
        // Router reference
        relatedTo: [routerId],
        
        // Status
        status: "active",
        "first-loginAt": null,
        expiresAt: null,
        
        // Optional fields
        ...(userData["limit-uptime"] && { "limit-uptime": userData["limit-uptime"] }),
        comment: userData.comment || generateComment(profileName),
        
        // Simple usage tracking
        usage: {
          timesUsed: 0,
          totalMinutes: 0,
          totalBytes: 0,
          firstUsed: null,
          lastUsed: null,
          devices: []
        },
        
        // Metadata
        createdBy: authenticatedUser?.id || "system",
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });
    
    // 6. Insert ALL vouchers at once
    const result = await db.collection(collection).insertMany(vouchers);
    
    // 7. Format response
    const createdVouchers = vouchers.map((voucher, index) => ({
      _id: result.insertedIds[index],
      name: voucher.name,
      profile: voucher.profile,
      status: voucher.status,
      comment: voucher.comment,
      createdAt: voucher.createdAt,
      routerId: routerId
    }));
    
    return {
      success: true,
      message: `Successfully created ${result.insertedCount} vouchers`,
      count: result.insertedCount,
      vouchers: createdVouchers
    };
    
  } catch (error) {
    console.error('Error creating multiple vouchers:', error);
    throw error;
  }
};


// Delete multiple users by names
export const deleteManyUsersByName = async (names, routerId, authenticatedUser = null) => {
  try {
    // collection is already defined at the top of your file
    
    // Optional: Verify ownership if user is authenticated
    if (authenticatedUser) {
      const router = await collection.findOne({
        type: "router",
        router_Id: routerId,
       userId : authenticatedUser.id
      });
      
      if (!router) {
        return {
          success: false,
          message: 'Unauthorized: You do not own this router',
          deleted: false,
          deletedCount: 0
        };
      }
    }
    
    // Perform deletion of multiple vouchers
    const result = await collection.deleteMany({ 
      type: "voucher", 
      name: { $in: names }, // Match any name in the array
      relatedTo: routerId 
    });
    
    // Check if anything was deleted
    if (result.deletedCount === 0) {
      return {
        success: false,
        message: `No vouchers found for the provided names`,
        deleted: false,
        deletedCount: 0,
        names: names
      };
    }
    
    return {
      success: true,
      message: `Successfully deleted ${result.deletedCount} voucher(s)`,
      deleted: true,
      deletedCount: result.deletedCount,
      names: names
    };
    
  } catch (error) {
    console.error(`Error deleting multiple users from MongoDB:`, error.message);
    
    if (error instanceof MongoError) {
      console.error('MongoDB Error Details:', {
        code: error.code,
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    throw error;
  }
};



//create new user account
export const createUser = async (userData) => {
  try {
    // 1. Sense check for required fields
    if (!userData.email || !userData.password || !userData.firstName || !userData.lastName) {
      throw new Error('Missing required fields: email, password, firstName, and lastName are required');
    }

    // 2. Check if user with same email already exists
    const collection = 'users';
    const existingUser = await db.collection(collection).findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // 3. 🔐 HASH THE PASSWORD BEFORE STORING!
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
    
    // 4. Prepare data with hashed password
    const insertData = {
      "email": userData.email,
      "password": hashedPassword,
      "firstName": userData.firstName,
      "lastName": userData.lastName,
      "createdAt": new Date(),
      "updatedAt": new Date(),
      "balance":0,
      "status": null,
      "routers": [], 
    };
    
    // 5. Insert the user
    const result = await db.collection(collection).insertOne(insertData);
    
    return {
      success: true,
      data: {
        id: result.insertedId,
        email: insertData.email,
        firstName: insertData.firstName,
        lastName: insertData.lastName
      }
    };
    
  } catch (error) {
    // Return error in a consistent format
    return {
      success: false,
      error: error.message
    };
  }
};