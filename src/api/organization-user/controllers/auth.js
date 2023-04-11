const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const _ = require('lodash');
const utils = require('@strapi/utils');
const { getAbsoluteAdminUrl, getAbsoluteServerUrl, sanitize } = utils;
const { ApplicationError, ValidationError } = utils.errors;

const client = require("../../../../config/pg");

const {
  validateRegisterBody,
} = require('./validation/auth');

module.exports = {
  async login(ctx) {
    try {
      const { email, password } = ctx.request.body;

      if (!email || !password) {
        return ctx.badRequest(null, [
          { messages: [{ id: "Email or password missing" }] },
        ]);
      }

      const finduser = await strapi
        .query("api::organization-user.organization-user")
        .findOne({ email });

      if (!finduser || !finduser.password) {
        return ctx.badRequest(null, [
          { messages: [{ id: "Invalid email or password" }] },
        ]);
      }

      const isValidPassword = await bcrypt.compare(password, finduser.password);

      if (!isValidPassword) {
        return ctx.badRequest(null, [
          { messages: [{ id: "Invalid password" }] },
        ]);
      }

      const sqlQuery = `
        SELECT ou.id,
               ou.first_name,
               ou.last_name,
               ou.phone,
               ou.email,
               ur.name AS role,
               orgs.organization_name AS organization
        FROM organization_users ou 
        LEFT JOIN organization_users_role_links ourl ON ou.id = ourl.organization_user_id 
        LEFT JOIN up_roles ur ON ourl.role_id = ur.id
        LEFT JOIN organization_users_organization_links ouol ON ouol.organization_user_id = ou.id
        LEFT JOIN organizations orgs ON ouol.organization_id = orgs.id
        WHERE ou.id = $1;`;

      const result = await client.query(sqlQuery, [finduser.id]);

      const token = jwt.sign(
        {
          id: result.rows[0].id,
          role: result.rows[0].role,
          organization: result.rows[0].organization,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "1d",
        }
      );

      ctx.send({
        jwt: token,
        result: result.rows,
      });
    } catch (error) {
      console.log(error);
    }
  },

  //------------------------------------------------------------------------------------------------------

  //register endpoint

  //------------------------------------------------------------------------------------------------------
  async register(ctx) {
    const pluginStore = await strapi.store({ type: 'plugin', name: 'users-permissions' });

    const settings = await pluginStore.get({ key: 'advanced' });

    if (!settings.allow_register) {
      throw new ApplicationError('Register action is currently disabled');
    }

    const params = {
      ..._.omit(ctx.request.body, [
        'confirmed',
        'blocked',
        'confirmationToken',
        'resetPasswordToken',
        'provider',
      ]),
      provider: 'local',
    };

    await validateRegisterBody(params);

    const role = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { name: 'Admin' } });

    if (!role) {
      throw new ApplicationError('Impossible to find the default role');
    }

    const { email, username, provider } = params;

    const identifierFilter = {
      $or: [
        { email: email.toLowerCase() },
        { username: email.toLowerCase() },
        { username },
        { email: username },
      ],
    };

    const conflictingUserCount = await strapi.query('api::organization-user.organization-user').count({
      where: { ...identifierFilter, provider },
    });

    console.log(conflictingUserCount);

    if (conflictingUserCount > 0) {
      throw new ApplicationError('Email or Username are already taken');
    }

    if (settings.unique_email) {
      const conflictingUserCount = await strapi.query('plugin::users-permissions.user').count({
        where: { ...identifierFilter },
      });

      if (conflictingUserCount > 0) {
        throw new ApplicationError('Email or Username are already taken');
      }
    }

    const newUser = {
      ...params,
      role: role.id,
      email: email.toLowerCase(),
      username,
      confirmed: !settings.email_confirmation,
    };

    const user = await getService('user').add(newUser);

    const sanitizedUser = await sanitizeUser(user, ctx);

    if (settings.email_confirmation) {
      try {
        await getService('user').sendConfirmationEmail(sanitizedUser);
      } catch (err) {
        throw new ApplicationError(err.message);
      }

      return ctx.send({ user: sanitizedUser });
    }

    const jwt = getService('jwt').issue(_.pick(user, ['id']));

    return ctx.send({
      jwt,
      user: sanitizedUser,
    });
  },
};
