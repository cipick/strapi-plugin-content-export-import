'use strict';

const utils  = require('./utils/content');
const { omit } = require('lodash');

/**
 * ContentExportImport.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

module.exports = {
  importData: async (ctx) => {
    const { targetModel, source, kind } = ctx.request.body;
    try {
      if (kind === 'collectionType' && source) {
        const items = source.data;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const files = Object.keys(item).filter((key)=> item[key].url).map((key) => ({ path: key, ...item[key]}))
          const itemWithoutFiles = omit(item, files.map((file)=> file.path))
          const entity = await utils.importItemByContentType(targetModel, itemWithoutFiles)
          for(const file of files){
            await utils.uploadToLibrary(file.url, entity, targetModel, file.path);
          }
        }
      } else {
        await utils.importSingleType(targetModel, source);
      }
    } catch (e) {
      ctx.throw(409, e.message);
    }
  },
  deleteAllData: async (targetModelUid, ctx) => {
    try {
      const all = await utils.findAll(targetModelUid);
      const ids = (Array.isArray(all)) ? all.map(item => item.id) : [all.id];
      await utils.deleteByIds(targetModelUid, ids);
      return ids.length;
    } catch (e) {
      ctx.throw(409, e.message);
    }
  },
  findAll: async (uid) => {
    const all = await utils.findAll(uid);
    return all;
  }
};
