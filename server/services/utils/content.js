const _ = require('lodash');
const axios = require('axios').default;
const fs = require('fs');
const stream = require('stream');
const path = require('path');
const promisify = require('util').promisify;
const mime = require('mime-types');

const importItemByContentType = (uid, data) => {
  return strapi.entityService.create(uid, {
    data,
    populate: '*'
  });
};

const importSingleType = async (uid, { data }) => {
  const existing = await strapi.services[uid].findOne({});
  if (existing) {
    return strapi.services[uid].update({
      where: {
        id: existing.id,
      },
      data,
    })
  } else {
    return strapi.services[uid].create({
      data,
    });
  }
};

const removeCreatorAndUpdaterInfo = (item) => {
  delete item.createdBy;
  delete item.updatedBy;
}

const findAll = async (uid) => {
  const result = await strapi.entityService.findMany(uid, {
    populate: '*',
  });
  if (Array.isArray(result)) {
    result.forEach((value) => {
      removeCreatorAndUpdaterInfo(value);
    });
  } else {
    removeCreatorAndUpdaterInfo(result);
  }
  return result;
};

const deleteByIds = (uid, ids) => {
  return strapi.services[uid].deleteMany({
    where: {
      id: {
        $in: ids,
      }
    }
  });
};

const getFileDetails = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err) reject(err.message);
      resolve(stats);
    });
  });
}

const deleteFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) reject(err.message);
      resolve('deleted');
    });
  });
}

const fetchAndSaveTempFiles = async (url)=> {
  const parsed = new URL(url);
  const filename = parsed.pathname.split('/').pop().toLowerCase();
  const temporaryPath = '.tmp/' + filename;
  const { data, headers } = await axios.get(url, {
    responseType: 'stream',
  });
  const file = fs.createWriteStream(temporaryPath);
  const finished = promisify(stream.finished);
  data.pipe(file);
  await finished(file);
  const stats = await getFileDetails(temporaryPath);
  return {
    path: temporaryPath,
    name: filename.replace(/\.[a-zA-Z]*$/, ''),
    type: headers['content-type'].split(';').shift(),
    size: stats.size,
    filename
  }
}

const uploadToLibrary = async (imageByteStreamURL, entity, model, field) => {
  const fetchPromises = imageByteStreamURL.map(fetchAndSaveTempFiles)
  const fileBuffers = await Promise.all(fetchPromises);

  await strapi.entityService.uploadFiles(model, entity, {
    [field]: fileBuffers
  });
}

const upload = async (filePath, saveAs) => {
  const stats = await getFileDetails(filePath);
  const fileName = path.parse(filePath).base;

  const res = await strapi.plugins.upload.services.upload.upload({
    data: { path: saveAs },
    files: {
      path: filePath,
      name: fileName,
      type: mime.lookup(filePath),
      size: stats.size,
    },
  });

  await deleteFile(filePath);
  return _.first(res);
}

module.exports = {
  importItemByContentType,
  findAll,
  deleteByIds,
  importSingleType,
  uploadToLibrary
};
