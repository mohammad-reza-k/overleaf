const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose


const TemplateSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    category: {
        type: String,
        required: true,
        index: true
    },
    subcategory: {
        type: String,
        default: '',
        index: true
    },
    author: {
        type: String,
        default: ''
    },
    version: {
        type: Number,
        default: 1
    },
    mainFile: {
        type: String,
        default: 'main.tex'
    },
    compiler: {
        type: String,
        default: 'pdflatex'
    },
    previewFile: {
        type: String,
        default: null
    },
    imageName: {
        type: String,
        default: null
    },
    filePath: {
        type: String,
        required: true
    },
    previewImage: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
   }
})

TemplateSchema.index({ category: 1, subcategory: 1 })
TemplateSchema.index({ title: 'text', description: 'text', author: 'text' })
exports.Template = mongoose.model('Template', TemplateSchema)
