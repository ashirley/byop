import express from "express";

const routerfn = () => {
  var router = express.Router();

  /* GET home page. */
  router.get("/", function (req, res, next) {
    res.render("index", { title: "Express" });
  });

  router.get("/api/pixelData", function (req, res, next) {
    res.json(req.devices.visualiserData);
  });

  router.ws("/api/pixelDataFeed", function (ws, req) {
    //data will be sent periodically from elsewhere.
    ws.on("message", function (msg) {
      console.log(msg);
    });
  });

  router.post("/devices", function (req, res, next) {
    req.devices.registerDevice(
      req.body.id,
      req.body.x,
      req.body.y,
      req.body.host
    );
    res.render("devices", {
      registeredDevices: req.devices.getRegisteredDevices(),
    });
  });

  // router.get("/devices/:deviceId", function (req, res, next) {
  //   const id = req.params.deviceId;
  //   res.render("devices", { title: "Express" });
  // });

  return router;
};

export default routerfn;
