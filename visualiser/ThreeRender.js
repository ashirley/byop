import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  LitElement,
  html,
  css,
  // @ts-ignore
} from "lit";

//https://stackoverflow.com/a/45046955/6950
function resizeCanvasToDisplaySize(renderer, camera) {
  const canvas = renderer.domElement;
  // look up the size the canvas is being displayed
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // adjust displayBuffer size to match
  if (canvas.width !== width || canvas.height !== height) {
    // you must pass false here or three.js sadly fights the browser
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // update any render target sizes here
  }
}

export class ThreeRender extends LitElement {
  static properties = {
    devices: {},
  };

  constructor() {
    super();
    this.pixelShapes = [];
  }
  static styles = css`
    canvas {
      width: 100%;
      height: 100%;
    }
  `;

  render() {
    return html`<canvas id="threeCanvas" style="display: block;"></canvas>`;
  }

  firstUpdated() {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    scene.add(group);
    const renderer = new THREE.WebGLRenderer({
      canvas: this.renderRoot.getElementById("threeCanvas"),
    });
    renderer.setPixelRatio(window.devicePixelRatio);

    //Add all the pixels
    this.createAndAddDevices(this.devices, scene);

    //ground plane
    const planeGeometry = new THREE.PlaneGeometry(100000, 100000);
    const PlaneMaterial = new THREE.MeshBasicMaterial({
      color: 0x008800,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeometry, PlaneMaterial);
    plane.translateZ(-20);
    scene.add(plane);

    // const axesHelper = new THREE.AxesHelper(500);
    // group.add(axesHelper);

    // const box = new THREE.BoxHelper(mesh, 0xffff00);
    // group.add(box);

    const camera = new THREE.PerspectiveCamera(
      75,
      1, //start with 1 aspect-ratio as this will be resized dynamically in the animation loop
      0.1,
      100000
    );

    //TODO: zoom out by default

    camera.up.set(0, 0, 1);
    // camera.position.x = fieldMaxX / 2;
    // camera.position.y = fieldMaxY / 2;
    camera.position.z = 5000;
    // camera.translateX(-750);
    // camera.translateY(-150);
    // console.log(bbMin.x - bbc.x, bbMin.y - bbc.y);
    // camera.translateY(bbMin.y - bbc.y);
    // camera.translateX(bbMin.x - bbc.x);

    //TODO: make this dynamic
    const fieldMinX = 0;
    const fieldMaxX = 22000;
    const fieldMinY = 0;
    const fieldMaxY = 10000;

    const controls = new OrbitControls(camera, renderer.domElement);
    // controls.target = new THREE.Vector3(fieldMaxX / 2, fieldMaxY / 2, 0);
    controls.target = new THREE.Vector3(fieldMaxX / 4, fieldMaxY / 4, 0);
    // controls.autoRotate = true;
    camera.lookAt(fieldMaxX / 2, fieldMaxY / 2, 0);

    function animate(timestamp) {
      resizeCanvasToDisplaySize(renderer, camera);
      //this.pixels.updateAll(timestamp);
      this.updateColors();

      requestAnimationFrame(animate);

      controls.update();

      renderer.render(scene, camera);
    }

    animate = animate.bind(this);

    animate();
    return renderer.domElement;
  }

  updateColors() {
    for (const [deviceId, device] of Object.entries(this.devices)) {
      for (const [pixelId, p] of Object.entries(device.pixels)) {
        if ("r" in p) {
          console.log("updating", deviceId, pixelId, p.r, p.g, p.b);
          this.pixelShapes[deviceId][pixelId].material.color.setRGB(
            p.r,
            p.g,
            p.b
          );
        } else {
          this.pixelShapes[deviceId][pixelId].material.color.setHSL(
            p.h,
            p.s,
            p.l
          );
        }
      }
    }
  }

  createPixel(d = 15, x = 0, y = 0, z = 0) {
    const geometry = new THREE.SphereGeometry(d, 32, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.translateX(x);
    sphere.translateY(y);
    sphere.translateZ(z);
    return sphere;
  }

  createAndAddDevice(id, x, y, pixels, scene) {
    if (!(id in this.pixelShapes)) {
      this.pixelShapes[id] = {};
    }
    const group = new THREE.Group();
    group.translateX(x);
    group.translateY(y);
    scene.add(group);

    for (const [pixelId, pixel] of Object.entries(pixels)) {
      const shape = this.createPixel(
        pixel.d || 15,
        pixel.x,
        pixel.y,
        pixel.z || 10
      );
      this.pixelShapes[id][pixelId] = shape;
      group.add(shape);
    }

    //TODO: translate so device coordinates are center of device?
    // group.translateX(-60);
    // group.translateY(-60);
  }

  createAndAddDevices(devices, scene) {
    for (const [deviceId, device] of Object.entries(devices)) {
      this.createAndAddDevice(
        deviceId,
        device.x,
        device.y,
        device.pixels,
        scene
      );
    }
  }
}
customElements.define("three-render", ThreeRender);
