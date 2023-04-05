module.exports = {
    routes: [
      {
        method: "POST",
        path: "/devices",
        handler: "device-controller.modify",
        config: {
          policies: [],
          middleware: []
        },
      },
    ],
  };
  