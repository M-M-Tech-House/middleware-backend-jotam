const moduleAlias = require('module-alias');
const path = require('path');

// Register alias for internal monorepo packages
moduleAlias.addAlias('@enode-restaurant', path.join(__dirname, 'node_modules/@M-M-Tech-House/enode-restaurant-package/packages'));

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3100;
const apiMiddleware = require('@M-M-Tech-House/enode-restaurant-package/apps/api');

// Enable CORS at the host level for all routes
app.use(cors({
    origin: process.env.API_CORS_ORIGIN === '*' ? '*' : (process.env.API_CORS_ORIGIN ? process.env.API_CORS_ORIGIN.split(',') : '*'),
    credentials: process.env.API_CORS_CREDENTIALS === 'true'
}));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Endpoint to check database statistics
app.get('/system/stats', async (req, res) => {
    try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({
                error: 'Database not connected',
                state: mongoose.connection.readyState,
                hint: 'Waiting for library to initialize connection...'
            });
        }

        const collections = await mongoose.connection.db.listCollections().toArray();
        const stats = [];

        for (const col of collections) {
            const count = await mongoose.connection.db.collection(col.name).countDocuments();
            stats.push({ collection: col.name, count });
        }

        res.json({
            database: mongoose.connection.name,
            collections: stats
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


if (apiMiddleware.app) {
    console.log('Detected ".app" property on exported object. Using it.');
    middlewareToMount = apiMiddleware.app;
} else if (apiMiddleware.router) {
    console.log('Detected ".router" property on exported object. Using it.');
    middlewareToMount = apiMiddleware.router;
} else if (typeof apiMiddleware === 'function') {
    middlewareToMount = apiMiddleware;
    console.log('Detected "function" on exported object. Using it.');
} else {
    console.warn(`Warning: The loaded library "@M-M-Tech-House/enode-restaurant-package" does not export a function and no .router/.app property was found.`);
}

// Mount the middleware at the configured API root (using API_PREFIX per user request)
const apiPrefix = process.env.API_PREFIX || '/';

if (middlewareToMount) {
    // If apiPrefix is /api and the library also has /api, we might want to mount at / 
    // to avoid /api/api/ routes. But to be safe, we'll just log it and let the debug endpoint guide the user.
    app.use(apiPrefix, middlewareToMount);
    console.log(`Successfully mounted library at prefix "${apiPrefix}".`);
    
    // Add a simple debug route to verify the internal app is reachable
    app.get('/system/debug', (req, res) => {
        // Try to get API_PATH from the library's env handler
        const libEnv = require('@M-M-Tech-House/enode-restaurant-package/packages/env-variables');
        
        res.json({
            status: 'ok',
            hostApiPrefix: apiPrefix,
            libraryApiPath: libEnv.API_PATH || 'N/A',
            fullPathExample: `${apiPrefix}${libEnv.API_PATH || ''}/sale`.replace(/\/+/g, '/'),
            hasMiddleware: !!middlewareToMount,
            nodeEnv: process.env.NODE_ENV,
            cwd: process.cwd()
        });
    });
} else {
    console.error('Critical Error: No middleware found to mount!');
}

// Export the app for Vercel
module.exports = app;

if (require.main === module) {
    app.listen(port, () => {
        console.log(`API Host running on port ${port}`);
    });
}
