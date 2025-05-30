import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  LitElement,
  html,
  css,
  // @ts-ignore
} from "lit";

const PIXEL_SIZE_GROUP = 1; // 175
const PIXEL_SIZE_SINGLE = 3; // 375
const FLOOR_HEIGHT = -1; // -500
const DEVICE_SIZE_X = 20;
const DEVICE_SIZE_Y = 20;

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
    const fieldMinX = Math.min(...Object.values(this.devices).map((d) => d.x));
    const fieldMaxX = Math.max(...Object.values(this.devices).map((d) => d.x));
    const fieldMinY = Math.min(...Object.values(this.devices).map((d) => d.y));
    const fieldMaxY = Math.max(...Object.values(this.devices).map((d) => d.y));

    const scene = new THREE.Scene();
    const group = new THREE.Group();
    group.translateX(-1 * fieldMinX);
    group.translateY(-1 * fieldMinY);
    scene.add(group);
    const renderer = new THREE.WebGLRenderer({
      canvas: this.renderRoot.getElementById("threeCanvas"),
    });
    renderer.setPixelRatio(window.devicePixelRatio);

    //Add all the pixels
    this.createAndAddDevices(this.devices, group);

    //ground plane
    const planeGeometry = new THREE.PlaneGeometry(
      fieldMaxX - fieldMinX + 2 * DEVICE_SIZE_X,
      fieldMaxY - fieldMinY + 2 * DEVICE_SIZE_Y
    );
    const PlaneMaterial = new THREE.MeshBasicMaterial({
      color: 0x008800,
      side: THREE.DoubleSide,
      // depthFunc: THREE.LessDepth,
      depthTest: false,
    });

    //TODO: there are rendering issues with the plane in place. I wonder if they will be removed if we change the scale by 10, 100 or 1000?
    const plane = new THREE.Mesh(planeGeometry, PlaneMaterial);
    plane.translateX((fieldMaxX - fieldMinX) / 2);
    plane.translateY((fieldMaxY - fieldMinY) / 2);
    plane.translateZ(FLOOR_HEIGHT);
    plane.renderOrder = -999;
    scene.add(plane);

    // const axesHelper = new THREE.AxesHelper(500);
    // scene.add(axesHelper);

    // const box = new THREE.BoxHelper(mesh, 0xffff00);
    // group.add(box);

    const camera = new THREE.PerspectiveCamera(
      75,
      1, //start with 1 aspect-ratio as this will be resized dynamically in the animation loop
      0.1,
      1000000
    );

    //TODO: zoom out by default

    camera.up.set(0, 0, 1);
    // camera.position.x = fieldMaxX / 2;
    // camera.position.y = fieldMaxY / 2;
    camera.position.z =
      Math.max(fieldMaxX - fieldMinX, fieldMaxY - fieldMinY) / 4;
    // camera.translateX(-750);
    // camera.translateY(-150);
    // console.log(bbMin.x - bbc.x, bbMin.y - bbc.y);
    // camera.translateY(bbMin.y - bbc.y);
    // camera.translateX(bbMin.x - bbc.x);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target = new THREE.Vector3(
      (fieldMaxX - fieldMinX) / 4,
      (fieldMaxY - fieldMinY) / 4,
      0
    );

    function animate() {
      resizeCanvasToDisplaySize(renderer, camera);
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
      if (this.pixelShapes[deviceId]) {
        for (const [pixelId, p] of Object.entries(device.pixels)) {
          if (this.pixelShapes[deviceId][pixelId]) {
            if ("r" in p) {
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
    }
  }

  createPixel(d = 1, x = 0, y = 0, z = 0) {
    const geometry = new THREE.SphereGeometry(d, 32, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.translateX(x);
    sphere.translateY(y);
    sphere.translateZ(z);
    return sphere;
  }

  createAndAddDevice(id, device, scene) {
    if (!(id in this.pixelShapes)) {
      this.pixelShapes[id] = {};
    }
    const group = new THREE.Group();
    group.translateX(device.x);
    group.translateY(device.y);
    scene.add(group);

    const defaultPixelSize =
      Object.entries(device.pixels).length > 1
        ? PIXEL_SIZE_GROUP
        : PIXEL_SIZE_SINGLE;
    for (const [pixelId, pixel] of Object.entries(device.pixels)) {
      const shape = this.createPixel(
        pixel.d || defaultPixelSize,
        (pixel.lX - 0.5) * DEVICE_SIZE_X,
        (pixel.lY - 0.5) * DEVICE_SIZE_Y,
        pixel.lZ || 0
      );
      this.pixelShapes[id][pixelId] = shape;
      group.add(shape);
    }
  }

  createAndAddDevices(devices, scene) {
    for (const [deviceId, device] of Object.entries(devices)) {
      this.createAndAddDevice(deviceId, device, scene);
    }
  }
}
customElements.define("three-render", ThreeRender);
