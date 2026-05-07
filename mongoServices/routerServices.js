import { ObjectId } from 'mongodb';
import crypto from 'crypto';

// Remove top-level db connection - will be passed in
let db = null;

// Initialize function to set the db instance
export const initializeDb = (dbInstance) => {
  db = dbInstance;
};
 
//
export const createRouter = async (userData) => {
    // ===========================================================
    // VALIDATION CHECKS
    // ===========================================================

    // 1. Check if userData exists
    if (!userData) {
        throw new Error('User data is required');
    }

    // 2. Validate user ID
    if (!userData.userId) {
        throw new Error('User ID is required');
    }

    // 3. Validate userId format (if it's supposed to be an ObjectId string)
    if (!ObjectId.isValid(userData.userId)) {
        throw new Error('Invalid User ID format');
    }

    // 4. Validate router name
    if (!userData.name) {
        throw new Error('Router name is required');
    }

    if (typeof userData.name !== 'string') {
        throw new Error('Router name must be a string');
    }

    if (userData.name.trim().length < 3) {
        throw new Error('Router name must be at least 3 characters long');
    }

    if (userData.name.trim().length > 50) {
        throw new Error('Router name must not exceed 50 characters');
    }

    // Sanitize name (remove any potentially harmful characters)
    const sanitizedName = userData.name.trim().replace(/[<>$&;`|]/, '');
    if (sanitizedName !== userData.name.trim()) {
        throw new Error('Router name contains invalid characters');
    }

    // 5. Validate hotspot name if provided
    if (userData.hotspotName) {
        if (typeof userData.hotspotName !== 'string') {
            throw new Error('Hotspot name must be a string');
        }

        if (userData.hotspotName.trim().length < 3) {
            throw new Error('Hotspot name must be at least 3 characters long');
        }

        if (userData.hotspotName.trim().length > 30) {
            throw new Error('Hotspot name must not exceed 30 characters');
        }

        // Hotspot names should be alphanumeric + underscore only (for RouterOS compatibility)
        if (!/^[a-zA-Z0-9_]+$/.test(userData.hotspotName.trim())) {
            throw new Error('Hotspot name can only contain letters, numbers, and underscores');
        }
    }

    // 6. Validate IP Address
    if (!userData.ipAddress) {
        throw new Error('Router IP address is required');
    }

    if (typeof userData.ipAddress !== 'string') {
        throw new Error('IP address must be a string');
    }

    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(userData.ipAddress.trim())) {
        throw new Error('Invalid IP address format');
    }

    // 7. Validate API Username
    if (!userData.api_username) {
        throw new Error('API username is required');
    }

    if (typeof userData.api_username !== 'string') {
        throw new Error('API username must be a string');
    }

    if (userData.api_username.trim().length < 2) {
        throw new Error('API username must be at least 2 characters long');
    }

    if (userData.api_username.trim().length > 50) {
        throw new Error('API username must not exceed 50 characters');
    }

    // 8. Validate API Password
    if (!userData.api_password) {
        throw new Error('API password is required');
    }

    if (typeof userData.api_password !== 'string') {
        throw new Error('API password must be a string');
    }

    if (userData.api_password.length < 6) {
        throw new Error('API password must be at least 6 characters long');
    }

    if (userData.api_password.length > 100) {
        throw new Error('API password must not exceed 100 characters');
    }

    // ===========================================================
    // DATABASE VALIDATIONS
    // ===========================================================

    // Declare collections at function scope
    const usersCollection = db.collection('users');
    const routersCollection = db.collection('hotspot');

    try {
        const userExists = await usersCollection.findOne({
            _id: new ObjectId(userData.userId)
        });

        if (!userExists) {
            throw new Error('User not found');
        }

        // 10. Check for duplicate router name for this user
        const existingRouter = await routersCollection.findOne({
            name: sanitizedName,
            userId: new ObjectId(userData.userId)
        });

        if (existingRouter) {
            throw new Error(`You already have a router named "${sanitizedName}". Please choose a different name.`);
        }

        // 11. Check for duplicate hotspot name (if hotspot names must be globally unique)
        if (userData.hotspotName) {
            const existingHotspot = await routersCollection.findOne({
                hotspotName: userData.hotspotName.trim()
            });

            if (existingHotspot) {
                throw new Error(`Hotspot name "${userData.hotspotName}" is already taken. Please choose a different name or leave it blank to auto-generate.`);
            }
        }

        // 12. Check for duplicate IP address (routers with same IP)
        const existingIpRouter = await routersCollection.findOne({
            ipAddress: userData.ipAddress.trim(),
            userId: new ObjectId(userData.userId)
        });

        if (existingIpRouter) {
            throw new Error(`You already have a router configured with IP address "${userData.ipAddress}". Please use a different IP address.`);
        }

        // 13. Check router limit per user (optional)
        const userRouterCount = await routersCollection.countDocuments({
            userId: new ObjectId(userData.userId)
        });

        const MAX_ROUTERS_PER_USER = 10; // Configure as needed
        if (userRouterCount >= MAX_ROUTERS_PER_USER) {
            throw new Error(`You have reached the maximum limit of ${MAX_ROUTERS_PER_USER} routers.`);
        }

    } catch (error) {
        // Re-throw database errors with clear messages
        if (error.message.includes('User not found') ||
            error.message.includes('already have a router') ||
            error.message.includes('already taken') ||
            error.message.includes('maximum limit')) {
            throw error;
        }
        throw new Error('Database validation failed: ' + error.message);
    }

    // ===========================================================
    // CREATE ROUTER  AND GENERATE BOOTSTRAP SCRIPT
    // ===========================================================

    try {
        const routerId = new ObjectId();
        const apiToken = 'Free_' + crypto.randomBytes(24).toString('hex');

        // Generate hotspot name if not provided
        const hotspotName = userData.hotspotName?.trim() ||
            sanitizedName.toLowerCase().replace(/\s+/g, '_') + '_' +
            Math.random().toString(36).substring(2, 6);

        const newRouter = {
            _id: routerId,
            relatedTo: [routerId],
            type:"router",
            name: sanitizedName,
            hotspotName: hotspotName,
            apiToken: apiToken,
            ipAddress: userData.ipAddress.trim(),
            api_username: userData.api_username.trim(),
            api_password: userData.api_password,
            userId: new ObjectId(userData.userId),
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSeen: null,
            configStatus: 'not_configured',
          
        };

        // Insert with retry logic (optional)
        let inserted = false;
        let retries = 3;

        while (!inserted && retries > 0) {
            try {
                await routersCollection.insertOne(newRouter);
                inserted = true;
            } catch (insertError) {
                retries--;
                if (retries === 0) throw insertError;
                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        console.log(`Router created successfully: ${routerId} for user: ${userData.userId}`);
        //update user document with new router reference (optional)
        await db.collection('users').updateOne(
            { _id: new ObjectId(userData.userId) },
            { $push: { routers: { id: routerId, name: sanitizedName } } }
        );

        // Generate bootstrap script

        const bootstrapScript = generateBootstrapScript(newRouter);
        // ===========================================================
        // RETURN SUCCESS RESPONSE
        // ===========================================================

        return {
            success: true,
            router: {
                id: routerId,
                name: sanitizedName,
                hotspotName: hotspotName,
                apiToken: apiToken,
                ipAddress: userData.ipAddress.trim(),
                api_username: userData.api_username.trim(),
                status: 'pending',
                createdAt: newRouter.createdAt,
                configStatus: 'not_configured'
            },
            bootstrapScript: bootstrapScript,
            message: 'Router created successfully. Use the bootstrap script to configure your MikroTik device.'
        };

    } catch (error) {
        console.error('Error creating router:', error);

        // Handle specific MongoDB errors
        if (error.code === 11000) {
            // Duplicate key error
            if (error.message.includes('hotspotName')) {
                throw new Error('Hotspot name already exists. Please try again.');
            }
            throw new Error('A router with these details already exists.');
        }

        throw new Error('Failed to create router: ' + error.message);
    }
};

// ===========================================================
// HELPER FUNCTION: Generate Bootstrap Script
// ===========================================================
function generateBootstrapScript(router) {
    // Validate inputs for script generation
    if (!router._id || !router.apiToken || !router.hotspotName || !router.name) {
        throw new Error('Missing required data for bootstrap script generation');
    }

    return `#===========================================================
# Bootstrap Script for ${router.name}
# Generated: ${new Date().toISOString()}
# Router ID: ${router._id}
#===========================================================

# Configuration
:local hotspotName "${router.hotspotName}"
:local routerId "${router._id}"
:local apiToken "${router.apiToken}"
:local routerIdentity "${router.name}"

# Log start
:log info "Starting bootstrap for ${router.name}"

# Get RouterOS version
:global version [/system package update get installed-version]
:put "RouterOS Version: \$version"

# Parse version for comparison (extract major.minor)
:local versionParts [:toarray [:pick \$version 0 [:find \$version "."]]]
:local majorVersion [:tonum [:pick \$version 0 [:find \$version "."]]]
:local minorVersion [:tonum [:pick \$version ([:find \$version "."] + 1) [:len \$version]]]

# Check if RouterOS version is below 7.9
:if (\$majorVersion < 7 or (\$majorVersion = 7 and \$minorVersion < 9)) do={
  :put "RouterOS version \$version is below 7.9. Updating..."
  
  # Download update package from server
  :local arch [/system resource get architecture-name]
  :local board ""
  :if ([:len [/system routerboard get board-name]] > 0) do={
    :set board [/system routerboard get board-name]
  }
  :local updateUrl "http://localhost:3000/api/mikrotik/firmware/update?version=\$version&routerId=${router._id}&arch=\$arch&board=\$board"
  :local updateResult [/tool fetch url=\$updateUrl dst-path="/update.npk" as-value output=user]
  
  :if (\$updateResult->"status" = "finished") do={
    :put "Update package downloaded successfully"
    
    # Create post-update configuration script
    :local postUpdateScript "\\
# Post-update configuration script\\
:put \"Running post-update configuration...\"\\
\\
# Enable required services for REST API communication\\
/ip service set www disabled=no port=80\\
/ip service set www-ssl disabled=no port=443\\
\\
# Enable API service for backend communication\\
/ip service set api disabled=no port=8728\\
\\
# Configure router identity for backend identification\\
/system identity set name=\"\$routerIdentity-\$routerId\"\\
\\
# Create API user for backend\\
:if ([:len [/user find name=\"backend-api\"]] = 0) do={\\
  /user add name=\"backend-api\" password=\"\$apiToken\" group=full\\
} else={\\
  /user set \"backend-api\" password=\"\$apiToken\"\\
}\\
\\
# Configure hotspot with unique name\\
/ip hotspot set [find] name=\"\$hotspotName\" disabled=no\\
\\
# Test internet connectivity\\
:put \"Testing internet connectivity...\"\\
:if ([/ping 8.8.8.8 count=3] = 0) do={\\
  :put \"ERROR: No internet connection. Please check network.\"\\
  :error \"No internet connection\"\\
}\\
:put \"Internet connectivity: OK\"\\
\\
# Setup walled garden\\
:put \"Configuring walled garden...\"\\
/ip hotspot walled-garden ip {\\
  remove [find comment=my-server]\\
  add action=accept dst-host=your-server.com comment=my-server\\
}\\
\\
# Register this router with backend\\
:put \"Registering router with server...\"\\
:local registerUrl \"http://your-server.com/api/mikrotik/register-router\"\\
:local registerResult [/tool fetch url=\$registerUrl \\\\
  http-method=post \\\\
  http-header-field=\"Authorization: Bearer ${router.apiToken}\" \\\\
  http-data=\"routerId=${router._id}&hotspotName=${router.hotspotName}\" \\\\
  as-value output=user]\\
\\
:if (\$registerResult->\"status\" = \"finished\") do={\\
  :put \"✓ Router registered successfully\"\\
} else={\\
  :put \"⚠ Router registration failed - will retry later\"\\
}\\
\\
:put \"\"\\
:put \"===================================================\"\\
:put \"✓ Post-update configuration completed for ${router.name}\"\\
:put \"===================================================\"\\
:put \"Router ID: ${router._id}\"\\
:put \"Hotspot Name: ${router.hotspotName}\"\\
:put \"===================================================\"\\
\\
:log info \"Post-update configuration completed for ${router.name}\"\\
\\
# Clean up - remove this script\\
/system script remove [find name=\"post-update-config\"]\\
"
    
    # Add the post-update script to scheduler
    /system script add name="post-update-config" source=\$postUpdateScript
    
    # Schedule it to run 2 minutes after reboot
    /system scheduler add name="post-update-scheduler" start-time=startup interval=0 on-event="/system script run post-update-config" start-date=jan/01/1970
    
    # Install the update (this will reboot the router)
    /system package install file-name=update.npk
    :put "Update installed. Router will reboot and continue configuration..."
    
    # Wait a moment before reboot
    :delay 5s
    
    # Reboot to apply update
    /system reboot
  } else={
    :put "Failed to download update package. Continuing with current version..."
    
    # Continue with normal configuration since update failed
    :goto continueConfig
  }
} else={
  :put "RouterOS version \$version is compatible (>= 7.9)"
  
  # Continue with normal configuration
  :goto continueConfig
}

# Label for continuing configuration
:continueConfig

# Enable required services for REST API communication
# According to MikroTik docs: www-ssl or www (starting with RouterOS v7.9) service must be running
/ip service set www disabled=no port=80
/ip service set www-ssl disabled=no port=443

# Enable API service for backend communication (optional, for API access)
/ip service set api disabled=no port=8728

# Configure router identity for backend identification
/system identity set name="\$routerIdentity-\$routerId"

# Create API user for backend (if not exists)
:if ([:len [/user find name="backend-api"]] = 0) do={
  /user add name="backend-api" password="\$apiToken" group=full
} else={
  /user set "backend-api" password="\$apiToken"
}

# Configure hotspot with unique name
/ip hotspot set [find] name="\$hotspotName" disabled=no

# Test internet connectivity
:put "Testing internet connectivity..."
:if ([/ping 8.8.8.8 count=3] = 0) do={
  :put "ERROR: No internet connection. Please check network."
  :error "No internet connection"
}
:put "Internet connectivity: OK"

# Setup walled garden
:put "Configuring walled garden..."
/ip hotspot walled-garden ip {
  remove [find comment=my-server]
  add action=accept dst-host=your-server.com comment=my-server
}

# Register this router with backend
:put "Registering router with server..."
:local registerUrl "http://localhost:3000/api/mikrotik/register-router"
:local registerResult [/tool fetch url=\$registerUrl \\
  http-method=post \\
  http-header-field="Authorization: Bearer ${router.apiToken}" \\
  http-data="routerId=${router._id}&hotspotName=${router.hotspotName}" \\
  as-value output=user]

:if (\$registerResult->"status" = "finished") do={
  :put "✓ Router registered successfully"
} else={
  :put "⚠ Router registration failed - will retry later"
}

:put ""
:put "==================================================="
:put "✓ Bootstrap completed for ${router.name}"
:put "==================================================="
:put "Router ID: ${router._id}"
:put "Hotspot Name: ${router.hotspotName}"
:put "==================================================="

:log info "Bootstrap completed for ${router.name}"
`;
}

// ===========================================================
// OPTIONAL: Add a validation function for reuse
// ===========================================================
export const validateRouterData = async (userData) => {
    const errors = [];

    // Sync validations
    if (!userData?.name) errors.push('Router name is required');
    else if (userData.name.length < 3) errors.push('Router name must be at least 3 characters');
    else if (userData.name.length > 50) errors.push('Router name must not exceed 50 characters');

    if (!userData?.userId) errors.push('User ID is required');
    else if (!ObjectId.isValid(userData.userId)) errors.push('Invalid User ID format');

    if (userData?.hotspotName) {
        if (userData.hotspotName.length < 3) errors.push('Hotspot name must be at least 3 characters');
        if (userData.hotspotName.length > 30) errors.push('Hotspot name must not exceed 30 characters');
        if (!/^[a-zA-Z0-9_]+$/.test(userData.hotspotName)) {
            errors.push('Hotspot name can only contain letters, numbers, and underscores');
        }
    }

    // Database validations (if needed)
    if (errors.length === 0) {
        const usersCollection = db.collection('users');
        const routersCollection = db.collection('hotspot');
        const userExists = await usersCollection.findOne({ _id: ObjectId(userData.userId) });
        if (!userExists) errors.push('User not found');

        const existingRouter = await routersCollection.findOne({
            name: userData.name.trim(),
            userId: ObjectId(userData.userId)
        });
        if (existingRouter) errors.push(`You already have a router named "${userData.name}"`);
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
};




export const getAll = async (userId) => {
  try {
    // Validate userId
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    if (!ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID format');
    }
    
    const routersCollection = db.collection('hotspot');
    const routers = await routersCollection.find({ 
      type: "router",
      userId: new ObjectId(userId)
    })
    .project({
      _id: 1,
      name: 1,
      hotspotName: 1,
      ipAddress: 1,
      api_username: 1,
      status: 1,
      configStatus: 1,
      lastSeen: 1,
      createdAt: 1
    })
    .sort({ createdAt: -1 })
    .toArray();

    const mappedRouters = routers.map((router) => ({
      ...router,
      id: router._id.toString(),
      apiUsername: router.api_username
    }));

    return {
      success: true,
      routers: mappedRouters,
      count: mappedRouters.length
    };
    
  } catch (error) {
    console.error('Error fetching routers:', error);
    return {
      success: false,
      error: error.message,
      routers: []
    };
  }
};

//delete router

export const deleteRouter = async (routerId, userId) => {
  try {
    // Validate inputs
    if (!routerId) {
      throw new Error('Router ID is required');
    }
    
    if (!userId) {
      throw new Error('User ID is required');
    }
    
  
    // Delete router - must belong to the user
    const routersCollection = db.collection('hotspot');
    const result = await routersCollection.deleteOne({ 
      _id: new ObjectId(routerId),  // ✅ Use _id, not routerId
      type: "router",
      userId: new ObjectId(userId)
    });
    
    // Check if router was found and deleted
    if (result.deletedCount === 0) {
      return {
        success: false,
        error: 'Router not found or not authorized'
      };
    }
    
    return {
      success: true,
      message: 'Router deleted successfully'
    };
    
  } catch (error) {
    console.error('Error deleting router:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete router'
    };
  }
};

// Get router by ID for a specific user
export const getRouterById = async (routerId, userId) => {
  try {
    // Validate inputs
    if (!routerId) {
      throw new Error('Router ID is required');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!ObjectId.isValid(routerId)) {
      throw new Error('Invalid router ID format');
    }

    if (!ObjectId.isValid(userId)) {
      throw new Error('Invalid user ID format');
    }

    const routersCollection = db.collection('hotspot');
    const router = await routersCollection.findOne({
      _id: new ObjectId(routerId),
      type: "router",
      userId: new ObjectId(userId)
    });

    if (!router) {
      return {
        success: false,
        error: 'Router not found or not authorized'
      };
    }

    return {
      success: true,
      router: router
    };

  } catch (error) {
    console.error('Error getting router:', error);
    return {
      success: false,
      error: error.message || 'Failed to get router'
    };
  }
};

// ===========================================================
// REGISTER ROUTER FUNCTION
// Updates router status to 'online' after bootstrap
// ===========================================================
export const registerRouter = async (routerId, updateData) => {
  try {
    // Validate inputs
    if (!routerId) {
      throw new Error('Router ID is required');
    }

    if (!ObjectId.isValid(routerId)) {
      throw new Error('Invalid router ID format');
    }

    if (!updateData || typeof updateData !== 'object') {
      throw new Error('Update data is required');
    }

    const routersCollection = db.collection('hotspot');

    const updateResult = await routersCollection.updateOne(
      { _id: new ObjectId(routerId) },
      { $set: updateData }
    );

    if (updateResult.matchedCount === 0) {
      return {
        success: false,
        error: 'Router not found'
      };
    }

    return {
      success: true,
      message: 'Router registered successfully',
      updateResult: updateResult
    };

  } catch (error) {
    console.error('Error registering router:', error);
    return {
      success: false,
      error: error.message || 'Failed to register router'
    };
  }
};
    


     