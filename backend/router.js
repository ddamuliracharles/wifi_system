import express from 'express';
import { getUsers, createuser, deleteUser, getProfiles, createMikrotikClient } from './mikrotikService.js';
import { createRouter,getAll,deleteRouter, getRouterById, registerRouter } from './mongoServices/routerServices.js';
import { loginUser,createUser } from './mongoServices/mogodbServices.js';
import  authenticateUser  from './middleware/auth_middleware.js';
import { authenticateRouter } from './middleware/auth_middleware.js';
import fs from 'fs';
import path from 'path';



const router = express.Router();

// Test endpoint to verify connection to a specific router
router.get('/test/:routerId', authenticateUser, async (req, res) => {
  try {
    const { routerId } = req.params;
    const userId = req.user.id; // From authentication middleware

    const routerResult = await getRouterById(routerId, userId);
    if (!routerResult.success) {
      return res.status(404).json(routerResult);
    }

    const routerConfig = {
      ipAddress: routerResult.router.ipAddress,
      api_username: routerResult.router.api_username,
      api_password: routerResult.router.api_password
    };

    const client = createMikrotikClient(routerConfig);
    const response = await client.get('/system/identity');

    res.status(200).json({
      success: true,
      message: 'Connected to MikroTik router',
      router: response.data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `Connection failed: ${error.message}`,
      details: error.response?.data
    });
  }
});






// Firmware directory structure
const FIRMWARE_DIR = './firmware';

// Target firmware version mapping based on current version
const FIRMWARE_VERSION_MAP = {
  'default': '7.20.8',  // Default target version
  '6': '7.20.8',        // Any 6.x → upgrade to 7.20.8
  '7': {               // Version 7.x mapping
    '0': '7.20.8', '1': '7.20.8', '2': '7.20.8', '3': '7.20.8',
    '4': '7.20.8', '5': '7.20.8', '6': '7.20.8', '7': '7.20.8',
    '8': '7.20.8'
  }
};

// Helper function to determine target firmware version
function getTargetFirmwareVersion(currentVersion) {
  const parts = currentVersion.split('.');
  const major = parts[0];
  const minor = parts[1];

  // Check for specific major version mapping
  if (FIRMWARE_VERSION_MAP[major]) {
    const versionMap = FIRMWARE_VERSION_MAP[major];
    if (typeof versionMap === 'object' && versionMap[minor]) {
      return versionMap[minor];
    } else if (typeof versionMap === 'string') {
      return versionMap;
    }
  }

  return FIRMWARE_VERSION_MAP['default'];
}

// GET firmware update endpoint
router.get('/firmware/update', async (req, res) => {
  try {
    // 1. Extract parameters from query string
    const { version, routerId, arch, architecture, board, model } = req.query;
    const architectureName = arch || architecture;
    const boardName = board || model;

    // Validate parameters
    if (!version) {
      return res.status(400).json({
        success: false,
        error: 'version parameter is required'
      });
    }

    if (!routerId) {
      return res.status(400).json({
        success: false,
        error: 'routerId parameter is required'
      });
    }

    if (!architectureName) {
      return res.status(400).json({
        success: false,
        error: 'arch parameter is required'
      });
    }

    console.log(`Firmware request - Version: ${version}, Router: ${routerId}, Arch: ${architectureName}, Board: ${boardName || 'none'}`);

    // 2. Parse current version
    const versionParts = version.split('.');
    const majorVersion = parseInt(versionParts[0], 10);
    const minorVersion = parseInt(versionParts[1], 10);

    // 3. Determine target firmware version
    const targetVersion = getTargetFirmwareVersion(version);
    console.log(`Target firmware version: ${targetVersion}`);

    // 4. Check if already at or above target
    const targetParts = targetVersion.split('.');
    const targetMajor = parseInt(targetParts[0], 10);
    const targetMinor = parseInt(targetParts[1], 10);

    if (majorVersion > targetMajor || (majorVersion === targetMajor && minorVersion >= targetMinor)) {
      return res.status(400).json({
        success: false,
        error: `RouterOS version ${version} is already at or above target version ${targetVersion}`
      });
    }

    // 5. Build firmware filename
    let firmwareFile = `routeros-${architectureName}-${targetVersion}.npk`;
    let firmwarePath = path.join(FIRMWARE_DIR, firmwareFile);

    // 6. Check for board-specific variant first
    if (boardName) {
      const boardFile = `routeros-${architectureName}-${boardName}-${targetVersion}.npk`;
      const boardPath = path.join(FIRMWARE_DIR, boardFile);
      if (fs.existsSync(boardPath)) {
        firmwareFile = boardFile;
        firmwarePath = boardPath; 
        console.log(`Using board-specific firmware: ${boardFile}`);
      }
    }

    // 7. Verify firmware file exists
    if (!fs.existsSync(firmwarePath)) {
      console.error(`Firmware file not found: ${firmwarePath}`);
      return res.status(404).json({
        success: false,
        error: `Firmware file ${firmwareFile} not available (target: ${targetVersion})`
      });
    }

    // 8. Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${firmwareFile}"`);

    // 9. Stream the file to the router
    const fileStream = fs.createReadStream(firmwarePath);

    fileStream.on('error', (error) => {
      console.error(`Error streaming firmware: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to stream firmware file'
      });
    });

    // Pipe file content to response
    fileStream.pipe(res);

    // 10. Optional: Log successful download
    fileStream.on('end', () => {
      console.log(`✓ Firmware ${firmwareFile} (${targetVersion}) served to router ${routerId}`);
    });

  } catch (error) {
    console.error('Firmware endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Firmware update service unavailable'
    });
  }
});



// GET all hotspot users from specific router
router.get('/users/:routerId', authenticateUser, async (req, res, next) => {
  try {
    const { routerId } = req.params;
    const userId = req.user.id;

    const routerResult = await getRouterById(routerId, userId);
    if (!routerResult.success) {
      return res.status(404).json(routerResult);
    }

    const routerConfig = {
      ipAddress: routerResult.router.ipAddress,
      api_username: routerResult.router.api_username,
      api_password: routerResult.router.api_password
    };

    const users = await getUsers(routerConfig);
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
});

//creating new user in database

router.post('/register', async (req, res) => {
  try {
    const result = await createUser(req.body);
    
    if (!result.success) {
      // Return error with same message format
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    // Return success response
    res.status(201).json({
      success: true,
      data: result.data
    });
    
  } catch (error) {
    // Handle unexpected errors
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// CREATE a new hotspot user on specific router
router.post('/user/add/:routerId', authenticateUser, async (req, res) => {
  try {
    const { routerId } = req.params;
    const { name, password, profile } = req.body;
    const userId = req.user.id;

    console.log('Request body:', req.body);

    // Validate input
    if (!name || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name and password are required'
      });
    }

    const routerResult = await getRouterById(routerId, userId);
    if (!routerResult.success) {
      return res.status(404).json(routerResult);
    }

    const routerConfig = {
      ipAddress: routerResult.router.ipAddress,
      api_username: routerResult.router.api_username,
      api_password: routerResult.router.api_password
    };

    const newUser = await createuser(routerConfig, name, password, profile);
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    console.error('Error creating user:', error.response?.data || error.message);

    res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to create user',
      details: error.response?.data || error.message
    });
  }
});

// DELETE a hotspot user from specific router
router.delete('/users/:username/:routerId', authenticateUser, async (req, res, next) => {
  try {
    const { username, routerId } = req.params;
    const userId = req.user.id;

    const routerResult = await getRouterById(routerId, userId);
    if (!routerResult.success) {
      return res.status(404).json(routerResult);
    }

    const routerConfig = {
      ipAddress: routerResult.router.ipAddress,
      api_username: routerResult.router.api_username,
      api_password: routerResult.router.api_password
    };

    const result = await deleteUser(routerConfig, username);
    res.status(200).json({ message: 'User deleted', result });
  } catch (error) {
    next(error);
  }
});





router.get('/routers', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Call your getAll method
    const result = await getAll(userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to fetch routers'
      });
    }
    
    res.status(200).json({
      success: true,
      routers: result.routers,
      count: result.routers.length
    });
    
  } catch (error) {
    console.error('Error in /routers route:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});













 
// ===========================================================
// ENDPOINT: Create Router (called from web UI)
// ===========================================================
router.post('/create-router', authenticateUser, async (req, res) => {
  try {
    // 1. Get userId from authenticated session (NOT from request body!)
    const userId = req.user.id; // From your authentication middleware
    
    // 2. Get router details from request body
    const { name, hotspotName, theme, currency,ipAddress,api_password,api_username } = req.body;
    
    console.log(`User ${userId} creating router: ${name}`);
    
    // 3. Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Router name is required'
      });
    }


    
    // 4. Call createRouter with userId included
    const result = await createRouter({
      name: name,
      hotspotName: hotspotName,
      userId: userId , // ← CRITICAL: Add userId from auth!
      ipAddress: ipAddress,
      api_password: api_password,
      api_username: api_username
    });


    
    // 5. Return full response with bootstrap script
    res.status(201).json({
      success: true,
      message: 'Router created successfully',
      router: {
        id: result.router.id,
        name: result.router.name,
        hotspotName: result.router.hotspotName,
        ipAddress: result.router.ipAddress,
        apiUsername: result.router.api_username,
        apiToken: result.router.apiToken,
        status: result.router.status,
        createdAt: result.router.createdAt,
        configStatus: result.router.configStatus
      },
      credentials: {
        apiToken: result.router.apiToken,  // Show once for user to save
        routerId: result.router.id
      },
      bootstrapScript: result.bootstrapScript,  // ← Include the script!
      instructions: {
        step1: "Copy the bootstrap script below",
        step2: "Open WinBox/WebFig and connect to your MikroTik router",
        step3: "Open Terminal and paste the entire script",
        step4: "Wait for 'Bootstrap complete' message"
      }
    });
    
  } catch (error) {
    console.error('Error creating router:', error);
    
    // Handle specific validation errors
    if (error.message.includes('already have a router')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('maximum limit')) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create router'
    });
  }
});






// delete router
router.delete('/routers/:id', authenticateUser, async (req, res) => {
  try {
    const routerId = req.params.id;
    const userId = req.user.id;
    
    const result = await deleteRouter(routerId, userId);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: result.error
      });
    }
    
    res.status(200).json({
      success: true,
      message: result.message
    });
    
  } catch (error) {
    console.error('Error in DELETE /routers/:id:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete router'
    });
  }
});










// ===========================================================
// REGISTER ROUTER ENDPOINT
// Called by router during bootstrap: 
// POST /api/routers/register
// Body: { routerId, hotspotName, routerName }
// Headers: Authorization: Bearer <apiToken>
// ===========================================================

// Apply authentication middleware FIRST, then handler
router.post('/register-router', authenticateRouter, async (req, res) => {
  try {
    // 1. Extract data from request
    const { id: routerId, hotspotName, name } = req.router; // From authenticateRouter middleware
    const { routerName } = req.body; // Get from request body if provided

    console.log(`Registration attempt for router: ${routerId}`);
    
    // 2. Prepare update data
    const updateData = {
      status: 'online',
      lastSeen: new Date(),
      ipAddress: req.ip, // Client IP address
      registeredAt: new Date(),
      configStatus: 'configured',
      updatedAt: new Date()
    }; 
    
    // Only update these if provided
    if (hotspotName) updateData.hotspotName = hotspotName;
    if (routerName) updateData.name = routerName; // Use from body
    else if (name) updateData.name = name; // Fallback to name from token
    
    // 3. Update router status in database using shared db instance
    const updateResult = await registerRouter(routerId, updateData);
    
    if (!updateResult.success) {
      console.log(`Router ${routerId} registration failed: ${updateResult.error}`);
      return res.status(500).json({ 
        success: false,
        message: updateResult.error || 'Failed to update router status' 
      });
    }
    
    console.log(`Router ${name || routerId} registered successfully from IP: ${req.ip}`);
    
    // 4. Return success response
    res.status(200).json({ 
      success: true,
      message: 'Router registered successfully',
      data: {
        routerId: routerId,
        status: 'online',
        serverTime: new Date().toISOString(),
        nextActions: [
          'Fetch configuration',
          'Start telemetry reporting'
        ]
      }
    });
    
  } catch (error) {
    console.error('Error registering router:', error);
    
    // Handle specific errors
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid router ID format' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to register router'
    });
  }
});





















// login endpoint for admin users (for web UI)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and password are required' 
      });
    }
    
    const result = await loginUser(email, password);
    
    res.status(200).json({
      success: true,  
      message: 'Login successful',
      token: result.token,
      user: result.user
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
});


// GET all profiles from specific router
router.get('/profiles/:routerId', authenticateUser, async (req, res, next) => {
  try {
    const { routerId } = req.params;
    const userId = req.user.id;

    const routerResult = await getRouterById(routerId, userId);
    if (!routerResult.success) {
      return res.status(404).json(routerResult);
    }

    const routerConfig = {
      ipAddress: routerResult.router.ipAddress,
      api_username: routerResult.router.api_username,
      api_password: routerResult.router.api_password
    };

    const profiles = await getProfiles(routerConfig);
    res.json(profiles);
  } catch (error) {
    next(error);
  }
});

// Endpoint to receive on-login POST
router.post('/voucher-login', (req, res) => {
  const { voucher_code, login_time } = req.body;
  console.log('Voucher login received:');
  console.log('Voucher Code:', voucher_code);
  console.log('Login Time:', login_time);
  res.status(200).send({ message: 'Login recorded successfully' });
});

export default router;