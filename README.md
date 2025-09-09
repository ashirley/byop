# Bring Your Own Pixels

A festival site lighting system which coordinates cheap led pixels and controllers brought by the participants.

With individually addressable LEDs and their controller getting cheaper, it is feasable for most festival attendees to bring a few hundred pixels, a controller and powersupply. This project will sync them up to display a pattern across the entire site.

## Architecture

The main service is in the **api** directory, and is responsible for managing and communicating with the controllers, receiving the control signal (DMX) and determining the color of each pixel. It also serves the administration pages for devices.

There is an optional **visualiser** which does a 3D render of the pixels laid out on the site.

There is an optional **dmxDemonstrator** which can generate DMX input if a real controller isn't available.

The **demoData** project contains some shared code for generating demo contollers and patterns which can be used for any of the other projects.

## Challenges

### Data

If there are a lot of pixels, there will be a potentially large amount of data needing to be sent. TODO: calculate how much

In a field with a lot of 2.4GHz devices, will E1.31 streams make it and still look good.

### Onboarding

It must be easy to enroll, even if you didn't realise you were going to do so until you arrived in a field with a box of electronics. There are a few aspects needed to making that true:

1. easy wifi setup on the controller
1. identifying the controller (whats its ip once connected to wifi)
1. registering and configuring the device
   * entering your controller details (ip)
   * configuring its location
   * pixel mapping the individual pixels
   * configure the controller

Most controllers have a way to do *1* even if it is quite manual. *2* is trickier and usually assumes you are using a home router and have access to the dhcp lease which was just given. There is a solution, at least for wled, in the [improv standard](https://www.improv-wifi.com) which allows configuring the wifi and getting the allocated address over serial (and bluetooth, although that doesnt enjoy wled support)

*3* is entirely within the realm of the byop software and we should make it as easy as possible to find a controller's ip and location and map the pixels.

It should be possible to pick a location on a map, aided but not reliant on a gps location

Pixel mapping should be optional and allow arbitrary complexity but also have a simple sketch-it-out option. We should tune the system to not need accurate pixel mapping which should be fine as we are not trying to project a high-res image, just a pattern / colour gradient.

The device should be configured according to the settings chosen (number of leds, enable sACN in the right mode, etc). Preferably, we would do that via API but if that's not possible we should prompt the user then redirect them to the config page.

#### mDNS

Another option for easing identification of controllers is useing mDNS. This allows querying the whole network to find devices supporting a particular service. wled responds to mDNS queries so we can identify all wled controllers on a network. There are 2 problems with this approach:

1. When lots of people are connecting lots of devices, how do you know which one is yours?
2. Big networks won't share mDNS broadcast packets to all clients so you only see a subset of the network.
    * This may be ok if mDNS is done client-side (but that is hard in the browser I believe) because someone's web browser and wled controller will likely be in the same network segment.
    * It may be possible to configure the network to forward all mDNS packets to our server but I'm not sure.

### Security

sACN is inherantly insecure (or at least assumes a trusted network) but with wled defaulting it to on, we aren't making it any worse (although we are encouraging people to bring them and connect them to the wifi and we are highlighting the problem). It would be good to have a network setup which limited inbound sACN on these devices to only be from our service

## Demos

* Demo 1 - [Video](https://makertube.net/w/nopRMve11MFwWB7X9ghCSL), [Script](DEMO.md#demo1).

## TODO

### Short term

* more e1.31 related wled settings
  * force max brightness?
  * high timeout
  * disable wifi sleep?
* why am I getting dmxMode warnings when it is right?
* error page on invalid device id page
* pre-select "drawn" on fix page
* limit LED count for a device or support multi universe e1.31

### Long term

* locating a device on a map
* user accounts
* support for other protocols
  * DDP is a protocol which is slightly more efficient, can control more pixels per packet, and can only send changed data.
