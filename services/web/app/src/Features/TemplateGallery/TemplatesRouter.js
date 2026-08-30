const AuthenticationController = require('../Authentication/AuthenticationController');
const TemplatesController = require('./TemplatesController');
const { RateLimiter } = require('../../infrastructure/RateLimiter');
const RateLimiterMiddleware = require('../Security/RateLimiterMiddleware');

const createProjectRateLimiter = new RateLimiter(
    'create-project-from-template',
    {
        points: 20,
        duration: 60,
    }
);

const listTemplatesRateLimiter = new RateLimiter(
    'list-templates',
    {
        points: 100,
        duration: 60,
    }
);

module.exports = {
    rateLimiter: createProjectRateLimiter,

    apply(app) {
        app.get(
            '/api/templates',
            RateLimiterMiddleware.rateLimit(listTemplatesRateLimiter),
            TemplatesController.listTemplates
        );
        
        app.get(
            '/api/templates/categories',
            RateLimiterMiddleware.rateLimit(listTemplatesRateLimiter),
            TemplatesController.getCategories
        );

        app.get(
            '/api/templates/:id',
            RateLimiterMiddleware.rateLimit(listTemplatesRateLimiter),
            TemplatesController.getTemplate
        );

        app.post(
            '/project/new/template',
            AuthenticationController.requireLogin(),
            RateLimiterMiddleware.rateLimit(createProjectRateLimiter),
            TemplatesController.createProjectFromTemplate
        );
    },
};
