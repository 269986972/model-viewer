/* @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License atQ
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import '@babylonjs/loaders/glTF';

import {ArcRotateCamera, Axis, Engine, HDRCubeTexture, Matrix, Scene, SceneLoader, Space, Tools, Vector3} from '@babylonjs/core';
import {css, customElement, html, LitElement, property} from 'lit-element';

import {ScenarioConfig} from '../../common.js';

// const IS_BINARY_RE = /\.glb$/;

const $initialize = Symbol('initialize');
const $updateScenario = Symbol('scenario');
const $updateSize = Symbol('updateSize');
const $render = Symbol('render');
const $canvas = Symbol('canvas');
const $engine = Symbol('engine');
const $scene = Symbol('scene');
const $camera = Symbol('camera');
const $hdrTexture = Symbol('hdrTexture');


@customElement('babylon-viewer')
export class BabylonViewer extends LitElement {
  @property({type: Object}) scenario: ScenarioConfig|null = null;
  private[$canvas]: HTMLCanvasElement|null;
  private[$engine]: Engine;
  private[$scene]: Scene;
  private[$camera]: ArcRotateCamera;
  private[$hdrTexture]: HDRCubeTexture;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
  }

  disconnectedCallback() {
  }

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);
    this[$updateSize]();

    if (changedProperties.has('scenario') && this.scenario != null) {
      this[$updateScenario](this.scenario);
    }
  }

  static get styles() {
    return css`
:host {
 display: block;
}
`;
  }

  render() {
    this[$render]();
    return html`<canvas id="canvas"></canvas>`;
  }


  private[$initialize]() {
    this[$canvas] = this.shadowRoot!.querySelector('canvas');
    this[$engine] = new Engine(this[$canvas], true);
    this[$scene] = new Scene(this[$engine]);
    SceneLoader.ShowLoadingScreen = false;
  }


  private async[$updateScenario](scenario: ScenarioConfig) {
    if (this[$scene] != null) {
      this[$scene].dispose();
    }

    this[$initialize]();
    // this[$scene].clearColor = new Color4(0,0,0,0);
    this[$updateSize]();

    // create camera
    const {orbit, target} = scenario;
    const alpha = (orbit.theta + 90) * Math.PI / 180;
    let beta = orbit.phi * Math.PI / 180;

    this[$camera] = new ArcRotateCamera(
        'Camera',
        alpha,
        beta,
        orbit.radius,
        new Vector3(-target.x, target.y, target.z),
        this[$scene]);
    this[$camera].attachControl(this[$canvas]!, true);
    console.log(this[$camera]);
    // load model
    const lastSlashIndex = scenario.model.lastIndexOf('/');
    const modelRootPath = scenario.model.substring(0, lastSlashIndex + 1);
    const modelFileName =
        scenario.model.substring(lastSlashIndex + 1, scenario.model.length);

    /*
    await new Promise((resolve) => {
        SceneLoader.LoadAssetContainer(modelRootPath, modelFileName,
    this[$scene], (container)=>{ console.log(container);
          console.log(container.meshes[0].getHierarchyBoundingVectors());
          container.addAllToScene();
          resolve();
        });
      });
    */
    await SceneLoader.AppendAsync(modelRootPath, modelFileName, this[$scene])
        .then(() => {
          const {min, max} =
              this[$scene].meshes[0].getHierarchyBoundingVectors();
          const modelRadius =
              Math.max(max.x - min.x, max.y - min.y, max.z - min.z);
          const far = 2 * Math.max(modelRadius, orbit.radius);
          const near = far / 1000;
          console.log(near, far);
          this[$camera].minZ = near;
          // this[$camera].maxZ = far;
        });

    this[$scene].stopAllAnimations();

    // load hdr directly (the size of cubmap is set to be 256 for all renderers)
    this[$hdrTexture] = new HDRCubeTexture(
        scenario.lighting, this[$scene], 256, false, false, false);
    this[$scene].environmentTexture = this[$hdrTexture];
    this[$hdrTexture].setReflectionTextureMatrix(
        Matrix.RotationY(Tools.ToRadians(180)));

    const skyboxHolder =
        this[$scene].createDefaultSkybox(this[$scene].environmentTexture!);
    skyboxHolder!.rotate(Axis.Y, Math.PI, Space.WORLD);
    skyboxHolder!.infiniteDistance = true;


    this[$engine].runRenderLoop(() => {
      this[$scene].render();
    });

    this[$scene].executeWhenReady(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.dispatchEvent(
              new CustomEvent('model-visibility', {detail: {visible: true}}));
        });
      });
    })
  }

  private[$render]() {
  }

  private[$updateSize]() {
    if (this[$canvas] == null || this.scenario == null) {
      return;
    }

    const canvas = this[$canvas]!;
    const {dimensions} = this.scenario;

    const dpr = window.devicePixelRatio;
    const width = dimensions.width * dpr;
    const height = dimensions.height * dpr;

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
  }
}
