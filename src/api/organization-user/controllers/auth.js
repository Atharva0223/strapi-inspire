const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const client = require("../../../../config/pg");

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
    const {
      first_name,
      last_name,
      email,
      password,
      phone,
      role,
      organization,
    } = ctx.request.body;

    // Check if all required fields are provided
    if (
      !email ||
      !password ||
      !first_name ||
      !last_name ||
      !phone ||
      !role ||
      !organization
    ) {
      return ctx.badRequest(null, [{ messages: ["All fields are required"] }]);
    }

    try {
      // Check if user already exists in the database
      const finduser = await strapi
        .query("api::organization-user.organization-user")
        .findOne({
          where: {
            email: email,
            isDeleted: false,
          },
        });

      if (finduser) {
        return ctx.badRequest(null, [
          { messages: [{ id: "email already exists" }] },
        ]);
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      // Create a new user in the database
      const newUser = await strapi
        .query("api::organization-user.organization-user")
        .create({
          data: {
            first_name,
            last_name,
            email,
            phone,
            password: hashedPassword,
            role,
            organization,
          },
        });

      // Generate JWT token
      const token = jwt.sign(
        {
          id: newUser.id,
          organization,
          email,
          role,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: "30d",
        }
      );

      const adminRole = await strapi
        .query("role", "users-permissions")
        .findOne({ type: "admin" });
      if (newUser.role.id === adminRole.id) {
        const userPluginModel = strapi.plugins["users-permissions"].models.user;
        await userPluginModel.update(
          { id: newUser.id },
          { adminCount: userPluginModel.sequelize.literal("adminCount + 1") }
        );
      }

      // Set the token in the response
      ctx.send({
        jwt: token,
        newUser: {
          first_name,
          last_name,
          phone,
          email,
          role,
          organization,
        },
      });
    } catch (err) {
      console.error(err);
      return ctx.badRequest(null, [
        { messages: ["An error occurred while creating a new user"] },
      ]);
    }
  },
};
