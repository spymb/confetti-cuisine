import swaggerJsdoc from 'swagger-jsdoc';

/* ================================================================================
 * Swagger / OpenAPI 配置
 * ================================================================================
 * 使用 swagger-jsdoc 从控制器 JSDoc 注释中提取 API 文档。
 * 访问地址：http://localhost:3000/api-docs
 * ================================================================================ */

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '缤纷厨房 API',
      version: '1.0.0',
      description: 'Confetti Cuisine — 烹饪学校 RESTful API 文档',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: '开发服务器',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/controllers/api/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
