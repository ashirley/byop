import express from "express";
var router = express.Router();

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});

router.get("/devices", function (req, res, next) {
  res.render("devices", {
    existingDevices: req.devices.existingDevices(),
  });
});

router.post("/devices", function (req, res, next) {
  req.devices.addDevice(req.body.id, req.body.x, req.body.y, req.body.ipAddr);
  res.render("devices", {
    existingDevices: req.devices.existingDevices(),
  });
});

// router.get("/devices/:deviceId", function (req, res, next) {
//   const id = req.params.deviceId;
//   res.render("devices", { title: "Express" });
// });

export default router;
