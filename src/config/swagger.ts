import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Smart Summary / Analysis API",
      version: "1.0.0",
      description: "API documentation for Analysis Service",
    },
    servers: [
      {
        url: process.env.PUBLIC_BASE_URL || `http://localhost:3000`,
        description: "Local server",
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
