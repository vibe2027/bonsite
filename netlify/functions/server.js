// Netlify Serverless Function - Routes all API requests through Express

const serverlessHttp = require('serverless-http');
const app = require('../../server');

// Export the handler for Netlify
module.exports.handler = serverlessHttp(app);
