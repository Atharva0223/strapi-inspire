module.exports = {
  routes: [
    {
      method: "POST",
      path: "/organization-user/register",
      handler: "auth.register",
      config: {
        policies: [],
        middleware: [],
      },
    },
    {
      method: "POST",
      path: "/organization-user/login",
      handler: "auth.login",
      config: {
        policies: [],
        middleware: [],
      },
    },
  ],
};
