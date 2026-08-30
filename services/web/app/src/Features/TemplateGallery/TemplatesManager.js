const { Project } = require('../../models/Project')
const { Template } = require('../../models/TemplateGallery')
const ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
const ProjectOptionsHandler =
  require('../Project/ProjectOptionsHandler').promises
const ProjectRootDocManager =
  require('../Project/ProjectRootDocManager').promises
const ProjectUploadManager = require('../Uploads/ProjectUploadManager')
const util = require('util')
const logger = require('@overleaf/logger')
const settings = require('@overleaf/settings')
const Errors = require('../Errors/Errors')
const ClsiCacheManager = require('../Compile/ClsiCacheManager')
const path = require('path')
const fs = require('fs')
const os = require('os')
const AdmZip = require('adm-zip')

const TemplatesManager = {
  async createProjectFromTemplate(templateId, userId) {
    const template = await Template.findOne({
      _id: templateId,
      isActive: true,
    })

    if (!template) {
      throw new Errors.NotFoundError('Template not found')
    }

    const projectName = ProjectDetailsHandler.fixProjectName(template.title)

    const templateRoot = path.resolve(settings.path.templateFolder)

    const templatePath = path.resolve(
      templateRoot,
      template.filePath
    )

    if (!templatePath.startsWith(templateRoot + path.sep)) {
      throw new Error('Invalid template path')
    }

    const tempZipPath = path.join(
      os.tmpdir(),
      `template-${template._id}-${Date.now()}.zip`
    )

    try {
      await TemplatesManager._createFilteredZip(
        templatePath,
        tempZipPath
      )

      const attributes = {
        templateId: template._id,
        templateVersion: template.version,
      }

      const project =
        await ProjectUploadManager.promises.createProjectFromZipArchiveWithName(
          userId,
          projectName,
          tempZipPath,
          attributes
        )

      const prepareClsiCacheInBackground =
        ClsiCacheManager.prepareClsiCache(
          project._id,
          userId,
          {
            templateId,
            templateVersion: template.version,
          }
        ).catch(err => {
          logger.warn(
            {
              err,
              templateId,
              templateVersion: template.version,
              projectId: project._id,
            },
            'failed to prepare clsi-cache from template'
          )
        })

      await TemplatesManager._setCompiler(
        project._id,
        template.compiler
      )

      await TemplatesManager._setImage(
        project._id,
        template.imageName
      )

      await TemplatesManager._setMainFile(
        project._id,
        template.mainFile
      )

      const update = {
        templateId: template._id,
        templateVersion: template.version,
      }

      await Project.updateOne(
        { _id: project._id },
        update,
        {}
      )

      await prepareClsiCacheInBackground

      return project
    } finally {
      // Always remove temporary ZIP
      await fs.promises.rm(tempZipPath, {
        force: true,
      })
    }
  },

  async _createFilteredZip(sourceZipPath, destinationZipPath) {
    const zip = new AdmZip(sourceZipPath)
    const filteredZip = new AdmZip()

    const excludedFiles = new Set([
      'preview.pdf',
      'preview.png',
      'preview.jpg',
      'thumbnail.jpg',
    ])

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) {
        filteredZip.addFile(entry.entryName, Buffer.alloc(0))
        continue
      }

      const fileName = path.basename(entry.entryName)

      if (excludedFiles.has(fileName)) {
        logger.debug(
          {
            file: entry.entryName,
          },
          'excluding template preview file from project'
        )

        continue
      }

      filteredZip.addFile(
        entry.entryName,
        entry.getData()
      )
    }

    await new Promise((resolve, reject) => {
      try {
        filteredZip.writeZip(
          destinationZipPath,
          resolve
        )
      } catch (err) {
        reject(err)
      }
    })
  },

  async _setCompiler(projectId, compiler) {
    if (compiler == null) {
      return
    }

    await ProjectOptionsHandler.setCompiler(
      projectId,
      compiler
    )
  },

  async _setImage(projectId, imageName) {
    if (!imageName) {
      imageName = 'wl_texlive:2018.1'
    }

    await ProjectOptionsHandler.setImageName(
      projectId,
      imageName
    )
  },

  async _setMainFile(projectId, mainFile) {
    if (mainFile == null) {
      return
    }

    await ProjectRootDocManager.setRootDocFromName(
      projectId,
      mainFile
    )
  },
}

module.exports = {
  promises: TemplatesManager,

  createProjectFromTemplate: util.callbackify(
    TemplatesManager.createProjectFromTemplate
  ),
}