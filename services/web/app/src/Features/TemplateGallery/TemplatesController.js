const SessionManager = require('../Authentication/SessionManager');
const TemplatesManager = require('./TemplatesManager');
const { Template } = require('../../models/TemplateGallery');
const { expressify } = require('@overleaf/promise-utils');
const logger = require('@overleaf/logger');
const Errors = require('../Errors/Errors');

const TemplatesController = {
    async createProjectFromTemplate(req, res) {
        const userId = SessionManager.getLoggedInUserId(req.session);

        const project = await TemplatesManager.promises.createProjectFromTemplate(
            req.body.templateId,
            userId
        );

        if (!project) {
            throw new Error('failed to create project from template');
        }

        return res.redirect(`/project/${project._id}`);
    },

    async listTemplates(req, res) {
        try {
            const { category, subcategory, search, limit = 50, page = 1 } = req.query;

            const filter = { isActive: true };

            if (category) {
                filter.category = category;
            }

            if (subcategory) {
                filter.subcategory = subcategory;
            }

            if (search) {
                filter.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { author: { $regex: search, $options: 'i' } }
                ];
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [templates, totalCount] = await Promise.all([
                Template.find(filter)
                    .select('title description category subcategory author previewImage previewFile createdAt')
                    .sort('category subcategory title')
                    .limit(parseInt(limit))
                    .skip(skip)
                    .lean(),
                Template.countDocuments(filter)
            ]);

            const [categories, subcategories] = await Promise.all([
                Template.distinct('category', { isActive: true }),
                Template.distinct('subcategory', { isActive: true })
            ]);

            res.json({
                success: true,
                data: {
                    templates,
                    pagination: {
                        total: totalCount,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        pages: Math.ceil(totalCount / parseInt(limit))
                    },
                    filters: {
                        categories,
                        subcategories
                    }
                }
            });

        } catch (error) {
            logger.error({ err: error }, 'Failed to list templates');
            res.status(500).json({
                success: false,
                error: 'Failed to fetch templates'
            });
        }
    },

    async getTemplate(req, res) {
        try {
            const { id } = req.params;

            const template = await Template.findOne({
                _id: id,
                isActive: true
            }).lean();

            if (!template) {
                return res.status(404).json({
                    success: false,
                    error: 'Template not found'
                });
            }

            res.json({
                success: true,
                data: template
            });

        } catch (error) {
            logger.error({ err: error, templateId: req.params.id }, 'Failed to get template');
            res.status(500).json({
                success: false,
                error: 'Failed to fetch template details'
            });
        }
    },

    async getCategories(req, res) {
        try {
            const categories = await Template.aggregate([
                { $match: { isActive: true } },
                {
                    $group: {
                        _id: {
                            category: '$category',
                            subcategory: '$subcategory'
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $group: {
                        _id: '$_id.category',
                        subcategories: {
                            $push: {
                                name: '$_id.subcategory',
                                count: '$count'
                            }
                        },
                        total: { $sum: '$count' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        category: '$_id',
                        total: 1,
                        subcategories: 1
                    }
                },
                { $sort: { category: 1 } }
            ]);

            res.json({
                success: true,
                data: categories
            });

        } catch (error) {
            logger.error({ err: error }, 'Failed to get categories');
            res.status(500).json({
                success: false,
                error: 'Failed to fetch categories'
            });
        }
    }
};

module.exports = {
    createProjectFromTemplate: expressify(TemplatesController.createProjectFromTemplate),
    listTemplates: expressify(TemplatesController.listTemplates),
    getTemplate: expressify(TemplatesController.getTemplate),
    getCategories: expressify(TemplatesController.getCategories)
};