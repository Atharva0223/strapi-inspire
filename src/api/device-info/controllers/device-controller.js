module.exports = {
  async modify(ctx) {
    const {
      uniqueId,
      deviceId,
      osVersion,
      osName,
      devicePlatform,
      appVersion,
      deviceTimezone,
      deviceCurrentTimestamp,
      dtoken,
      modelName,
    } = ctx.request.body;

    //all fields are required
    if (
      !uniqueId ||
      !deviceId ||
      !osVersion ||
      !osName ||
      !devicePlatform ||
      !appVersion ||
      !deviceTimezone ||
      !deviceCurrentTimestamp ||
      !dtoken ||
      !modelName
    ) {
      return ctx.badRequest(null, [
        { messages: [{ id: "All fields are required" }] },
      ]);
    }
    //check if device exists
    const exists = await strapi
      .query("api::device-info.device-info")
      .findOne({ deviceId: deviceId });

    if (!exists) {
      if (uniqueId === 0) {
        const insert = await strapi
          .query("api::device-info.device-info")
          .create({
            data: {
              uniqueId,
              deviceId,
              osVersion,
              osName,
              devicePlatform,
              appVersion,
              deviceTimezone,
              deviceCurrentTimestamp,
              dtoken,
              modelName,
            },
          });
      } else {
        return ctx.badRequest(null, [
          { messages: [{ id: "auth.user_not_found" }] },
        ]);
      }
    } else if (exists) {
      if (uniqueId === exists.uniqueId) {
        //if 1 update data
        const update = await strapi
          .query("api::device-info.device-info")
          .update({
            where: { uniqueId: uniqueId },
            data: {
              uniqueId,
              deviceId,
              osVersion,
              osName,
              devicePlatform,
              appVersion,
              deviceTimezone,
              deviceCurrentTimestamp,
              dtoken,
              modelName,
            },
          });
      } else {
        return ctx.badRequest(null, [
          { messages: [{ id: "auth.user_not_found" }] },
        ]);
      }
    }
    //send response ?
    ctx.send("welcome");
  },
};
