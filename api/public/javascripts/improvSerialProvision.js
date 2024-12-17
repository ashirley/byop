import { ImprovSerial } from "/javascripts/vendor/improv/serial.js";

async function connectAndGetInfo() {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });
  const improv = new ImprovSerial(port, console);

  improv.addEventListener("state-changed", console.log);
  improv.addEventListener("error-changed", console.log);

  await improv.initialize();

  improv.addEventListener("disconnect", console.log);

  console.log({
    info: improv.info,
    nextUrl: improv.nextUrl,
  });

  return {
    improv,
    isWLED: improv.info.firmware === "WLED",
    wledVersion: improv.info.version,
  };
}

function reportError(summary, detail) {
  const fullMsg = detail ? summary + ": " + detail : summary;
  console.error(fullMsg);
  const msgEle = document.getElementsByClassName(
    "newdevicesform__provision-message"
  )[0];
  msgEle.textContent = fullMsg;
  msgEle.classList.remove("newdevicesform__provision-message--hidden");
}

export async function startEnrollment({ wifiSsid, wifiPassword }) {
  console.log("starting provisioning...");
  if (!navigator.serial) {
    reportError(
      'Serial not supported in this browser, Please use <a href="https://developer.mozilla.org/en-US/docs/Web/API/Serial#browser_compatibility">Chrome or Edge</a>.'
    );
    return;
  }

  var improv, isWLED, wledVersion;
  try {
    ({ improv, isWLED, wledVersion } = await connectAndGetInfo());
  } catch (e) {
    reportError("Error connecting to device", e);
    return;
  }

  if (!isWLED) {
    reportError(
      "serial device doesn't report that it is a WLED controller. Consider installing via https://install.wled.me/"
    );
    return;
  }

  console.log("Found WLED controller with firmware version " + wledVersion);

  if (!improv.nextUrl) {
    //no existing network connection, provision wifi access

    await improv.provision(
      wifiSsid,
      wifiPassword,
      30000 // Optional: Timeout in ms
    );
  }

  if (!improv.nextUrl) {
    reportError("Failed to provision wifi");
  } else {
    console.log("WLED controller has nextUrl " + improv.nextUrl);

    const host = URL.parse(improv.nextUrl).host;

    console.log("WLED controller has host " + host);

    // TODO: just load this up on the main enrollment page or should we wait to see it on the server via bonjour?

    // TODO: offer to change the hostname?
  }
}
