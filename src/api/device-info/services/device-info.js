'use strict';

/**
 * device-info service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::device-info.device-info');
