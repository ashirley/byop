import express from "express";
var router = express.Router();

function page(object, start, num) {
  return Object.keys(object)
    .slice(start, start + num)
    .reduce(function (acc, key) {
      acc[key] = object[key];
      return acc;
    }, {});
}

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});

router.get("/devices", function (req, res, next) {
  res.render("devices", {
    //TODO: proper paging, not just static top 10
    registeredDevices: page(req.devices.getRegisteredDevices(), 0, 10),
  });
});

router.post("/devices/new", function (req, res, next) {
  const newId = req.devices.registerDevice(
    req.body.x,
    req.body.y,
    req.body.host,
    JSON.parse(
      req.body.drawnPixelLocations || req.body.pixelLocations || "[[0,0]]"
    )
  );
  res.redirect("/devices/" + newId);
});

router.get("/devices/new", function (req, res, next) {
  const unregDevices = req.devices.getUnregisteredDevices();
  const latestUnregDevices = Object.entries(unregDevices)
    .slice(-10)
    .map(([k, v]) => Object.assign({}, v, { name: k }));

  res.render("newdevice", {
    unregisteredDevices: latestUnregDevices,
    wifiSsid: process.env.WIFI_SSID,
    wifiPassword: process.env.WIFI_PASSWORD,
  });
});

router.get("/devices/:deviceId", function (req, res, next) {
  const id = req.params.deviceId;
  const device = req.devices.getDeviceById(id);
  res.render("device", { device });
});

export default router;
