const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'mimAR Studio Task BackEnd APIS',
      version: '1.0.0',
      description: 'API documentation for your Node.js application',
    },
  },
  apis: ['./routers/auth.js'],
};
const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;