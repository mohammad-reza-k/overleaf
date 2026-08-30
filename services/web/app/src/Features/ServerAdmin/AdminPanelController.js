const userDelete = require('../User/UserDeleter');
const { OError } = require('../Errors/Errors');
const { User } = require('../../models/User');
const logger = require('@overleaf/logger');

const AdminPanelController = {
    async usersList(req, res, next) {
        try {
            const {
                search,
                page = 1,
                limit = 20,
                sortBy = 'signUpDate',
                sortOrder = -1,
                isAdmin,
                suspended
            } = req.query;

            const filter = {};

            if (search) {
                filter.$or = [
                    { email: { $regex: search, $options: 'i' } },
                    { first_name: { $regex: search, $options: 'i' } },
                    { last_name: { $regex: search, $options: 'i' } },
                    { 'emails.email': { $regex: search, $options: 'i' } }
                ];
            }

            if (isAdmin !== undefined) {
                filter.isAdmin = isAdmin === 'true';
            }

            if (suspended !== undefined) {
                filter.suspended = suspended === 'true';
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const sort = {};
            sort[sortBy] = parseInt(sortOrder);

            const [users, totalCount] = await Promise.all([
                User.find(
                    filter,
                    {
                        _id: 1,
                        email: 1,
                        first_name: 1,
                        last_name: 1,
                        signUpDate: 1,
                        lastLoggedIn: 1,
                        lastActive: 1,
                        isAdmin: 1,
                        suspended: 1,
                        loginCount: 1,
                        features: 1,
                        'emails.email': 1,
                        'emails.confirmedAt': 1
                    }
                )
                .sort(sort)
                .limit(parseInt(limit))
                .skip(skip)
                .lean(),
                User.countDocuments(filter)
            ]);

            const formattedUsers = users.map(user => ({
                _id: user._id,
                email: user.email,
                firstName: user.first_name || '',
                lastName: user.last_name || '',
                fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                signUpDate: user.signUpDate,
                lastLoggedIn: user.lastLoggedIn,
                lastActive: user.lastActive,
                isAdmin: user.isAdmin || false,
                suspended: user.suspended || false,
                loginCount: user.loginCount || 0,
                features: user.features || {},
                emails: user.emails || []
            }));

            res.status(200).json({
                success: true,
                data: formattedUsers,
                pagination: {
                    total: totalCount,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(totalCount / parseInt(limit))
                }
            });

        } catch (error) {
            logger.error({ err: error }, 'Failed to fetch users list');
            next(OError.tag(error, 'Failed to fetch users list'));
        }
    },

    async userInfo(req, res, next) {
        try {
            const { email, id } = req.params;
            
            let query = {};
            if (email) {
                query = { email };
            } else if (id) {
                query = { _id: id };
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Email or ID is required'
                });
            }

            const user = await User.findOne(query).lean();

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const formattedUser = {
                _id: user._id,
                email: user.email,
                firstName: user.first_name || '',
                lastName: user.last_name || '',
                fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                signUpDate: user.signUpDate,
                lastLoggedIn: user.lastLoggedIn,
                lastActive: user.lastActive,
                lastLoginIp: user.lastLoginIp || '',
                loginCount: user.loginCount || 0,
                isAdmin: user.isAdmin || false,
                suspended: user.suspended || false,
                features: user.features || {},
                emails: user.emails || [],
                referal_id: user.referal_id,
                refered_user_count: user.refered_user_count || 0,
                twoFactorAuthentication: user.twoFactorAuthentication || null,
                splitTests: user.splitTests || {},
                completedTutorials: user.completedTutorials || {},
                betaProgram: user.betaProgram || false,
                alphaProgram: user.alphaProgram || false,
                labsProgram: user.labsProgram || false
            };

            res.status(200).json({
                success: true,
                data: formattedUser
            });

        } catch (error) {
            logger.error({ err: error, email: req.params.email }, 'Failed to fetch user info');
            next(OError.tag(error, 'Failed to fetch user info'));
        }
    },

    async deleteUser(req, res, next) {
        try {
            const { email, id } = req.params;
            
            let query = {};
            if (email) {
                query = { email };
            } else if (id) {
                query = { _id: id };
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Email or ID is required'
                });
            }

            const user = await User.findOne(query).exec();
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // جلوگیری از حذف خود کاربر ادمین
            if (req.user && req.user._id.toString() === user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot delete your own account'
                });
            }

            await userDelete.promises.deleteUser(user._id, {
                deleterUser: req.user,
                ipAddress: req.ip,
            });

            logger.info(
                { userId: user._id, email: user.email, deleter: req.user?._id },
                'User deleted by admin'
            );

            res.sendStatus(204);

        } catch (error) {
            logger.error({ err: error, email: req.params.email }, 'Failed to delete user');
            next(OError.tag(error, 'Failed to delete user'));
        }
    },

    async searchUsers(req, res, next) {
        try {
            const { q, limit = 10 } = req.query;

            if (!q || q.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Search query must be at least 2 characters'
                });
            }

            const users = await User.find(
                {
                    $or: [
                        { email: { $regex: q, $options: 'i' } },
                        { first_name: { $regex: q, $options: 'i' } },
                        { last_name: { $regex: q, $options: 'i' } },
                        { 'emails.email': { $regex: q, $options: 'i' } }
                    ]
                },
                {
                    _id: 1,
                    email: 1,
                    first_name: 1,
                    last_name: 1,
                    isAdmin: 1,
                    suspended: 1
                }
            )
            .limit(parseInt(limit))
            .lean();

            const formattedUsers = users.map(user => ({
                _id: user._id,
                email: user.email,
                fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                isAdmin: user.isAdmin || false,
                suspended: user.suspended || false
            }));

            res.status(200).json({
                success: true,
                data: formattedUsers
            });

        } catch (error) {
            logger.error({ err: error, query: req.query.q }, 'Failed to search users');
            next(OError.tag(error, 'Failed to search users'));
        }
    },

    async getUserStats(req, res, next) {
        try {
            const [
                totalUsers,
                activeUsers,
                adminUsers,
                suspendedUsers,
                todaySignups,
                weekSignups,
                monthSignups
            ] = await Promise.all([
                User.countDocuments({}),
                User.countDocuments({
                    lastActive: {
                        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                }),
                User.countDocuments({ isAdmin: true }),
                User.countDocuments({ suspended: true }),
                User.countDocuments({
                    signUpDate: {
                        $gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }),
                User.countDocuments({
                    signUpDate: {
                        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }),
                User.countDocuments({
                    signUpDate: {
                        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                })
            ]);

            res.status(200).json({
                success: true,
                data: {
                    totalUsers,
                    activeUsers,
                    adminUsers,
                    suspendedUsers,
                    todaySignups,
                    weekSignups,
                    monthSignups,
                    activePercentage: totalUsers > 0
                        ? Math.round((activeUsers / totalUsers) * 100)
                        : 0
                }
            });

        } catch (error) {
            logger.error({ err: error }, 'Failed to fetch user stats');
            next(OError.tag(error, 'Failed to fetch user stats'));
        }
    },

    async toggleUserSuspension(req, res, next) {
        try {
            const { email, id } = req.params;
            const { suspend } = req.body;

            let query = {};
            if (email) {
                query = { email };
            } else if (id) {
                query = { _id: id };
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Email or ID is required'
                });
            }

            const user = await User.findOne(query);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            if (req.user && req.user._id.toString() === user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot suspend your own account'
                });
            }

            user.suspended = suspend === true;
            await user.save();

            logger.info(
                { 
                    userId: user._id, 
                    email: user.email, 
                    suspended: user.suspended,
                    admin: req.user?._id 
                },
                'User suspension toggled by admin'
            );

            res.status(200).json({
                success: true,
                data: {
                    _id: user._id,
                    email: user.email,
                    suspended: user.suspended
                },
                message: `User ${user.suspended ? 'suspended' : 'activated'} successfully`
            });

        } catch (error) {
            logger.error({ err: error, email: req.params.email }, 'Failed to toggle user suspension');
            next(OError.tag(error, 'Failed to toggle user suspension'));
        }
    }
};

module.exports = AdminPanelController;