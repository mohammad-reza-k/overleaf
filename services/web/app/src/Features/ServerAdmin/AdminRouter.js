// services/web/app/src/Features/ServerAdmin/AdminRouter.js

const AuthenticationController = require('../Authentication/AuthenticationController');
const AuthorizationMiddleware = require('../Authorization/AuthorizationMiddleware');
const AdminPanelController = require('./AdminPanelController');

module.exports = {
    apply(webRouter, privateApiRouter) {
        webRouter.get(
            '/admin/users',
            AuthorizationMiddleware.ensureUserIsSiteAdmin,
            AdminPanelController.usersList
        );

        webRouter.get(
            '/admin/users/search',
            AuthorizationMiddleware.ensureUserIsSiteAdmin,
            AdminPanelController.searchUsers
        );

        webRouter.get(
            '/admin/users/stats',
            AuthorizationMiddleware.ensureUserIsSiteAdmin,
            AdminPanelController.getUserStats
        );

        webRouter.get(
            '/admin/users/:email',
            AuthorizationMiddleware.ensureUserIsSiteAdmin,
            AdminPanelController.userInfo
        );

        webRouter.get(
            '/admin/users/id/:id',
            AuthorizationMiddleware.ensureUserIsSiteAdmin,
            AdminPanelController.userInfo
        );

        webRouter.delete(
            '/admin/users/:email',
            AuthorizationMiddleware.ensureUserIsSiteAdmin,
            AdminPanelController.deleteUser
        );

        webRouter.delete(
            '/admin/users/id/:id',
            AuthorizationMiddleware.ensureUserIsSiteAdmin,
            AdminPanelController.deleteUser
        );

        webRouter.post(
            '/admin/users/:email/toggle-suspension',
            AuthorizationMiddleware.ensureUserIsSiteAdmin,
            AdminPanelController.toggleUserSuspension
        );
        
        webRouter.post(
            '/admin/users/id/:id/toggle-suspension',
            AuthorizationMiddleware.ensureUserIsSiteAdmin,
            AdminPanelController.toggleUserSuspension
        );
    }
};