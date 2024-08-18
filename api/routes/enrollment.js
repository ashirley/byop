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
    existingDevices: page(req.devices.existingDevices(), 0, 10),
  });
});

router.post("/devices/new", function (req, res, next) {
  req.devices.addDevice(
    req.body.x,
    req.body.y,
    req.body.ipAddr,
    JSON.parse(
      req.body.drawnPixelLocations || req.body.pixelLocations || "[[0,0]]"
    )
  );
  res.redirect("/devices");
});

router.get("/devices/new", function (req, res, next) {
  const unregDevices = req.deviceScanner.getUnregisteredDevices();
  const latestUnregDevices = Object.keys(unregDevices).slice(-10);

  res.render("newdevice", {
    unregisteredDevices: latestUnregDevices,
  });
});

// router.get("/devices/:deviceId", function (req, res, next) {
//   const id = req.params.deviceId;
//   res.render("devices", { title: "Express" });
// });

export default router;
