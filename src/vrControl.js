/**
 * @author William Cong
 */

import * as T from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory  } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import { XRMarkerModelFactory  } from './XRMarkerModelFactory';
// import { degToRad, getCurrEEpose, mathjsMatToThreejsVector3 } from './utils';
import { CanvasUI } from './interfaces/WebXRCanvasUI'

export class VrControl {
    constructor(options) {

        this.relaxedIK = options.relaxedIK
        this.renderer = options.renderer
        this.scene = options.scene
        this.camera = options.camera;
        this.intervalID = undefined;
        this.mouseControl = options.mouseControl
        this.controlMapping = options.controlMapping;
        this.scale = 20000

        this.lastSqueeze = 0;
        this.lastTouchpad = 0
        this.defaultPosition = new T.Vector3();
        this.defaultPosition.set(1.5, 1.5, 0)

        // toggles robot control
        this.controlMode = false;
        this.reGround4DoF = true;

        // if true, send relative rotation (velocity) commend to relaxedik
        this.rel_rot = false;

        this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);
        const controllerModelFactory = new XRControllerModelFactory();
        this.controllerModel1 = controllerModelFactory.createControllerModel(this.controllerGrip1);

        this.hand1 = this.renderer.xr.getHand( 0 );
        const handModelFactory = new XRHandModelFactory();
        this.handModel1 = handModelFactory.createHandModel(this.hand1);
        
        const markerModelFactory = new XRMarkerModelFactory();
        this.markerModel1 = markerModelFactory.createMarkerModel(this.controllerGrip1);

        this.userGroup = new T.Group();
        this.userGroup.name = "user_group";
        this.userGroup.add(this.camera);
        this.userGroup.add(this.controllerGrip1);
        this.userGroup.add(this.hand1);
        this.scene.add(this.userGroup);

        this.select = this.select.bind(this);
        this.squeeze = this.squeeze.bind(this);

        this.controllerGrip1.addEventListener('select', this.select.bind(this));
        this.controllerGrip1.addEventListener('squeeze', this.squeeze.bind(this));
        let that = this;
        this.controllerGrip1.addEventListener('connected', (e) => {
            that.vive_buttons = e.data.gamepad;
        })

        let controllerVisSelect = document.querySelector('#controller-vis-select');
        controllerVisSelect.onchange = (user_change) => {
            switch (controllerVisSelect.value) {
                case 'None':
                    this.controllerGrip1.remove(this.controllerModel1);
                    this.controllerGrip1.remove(this.markerModel1);
                    this.hand1.remove(this.handModel1);
                    break;
                case 'Pen':
                    this.controllerGrip1.remove(this.controllerModel1);
                    this.controllerGrip1.add(this.markerModel1);
                    this.hand1.remove(this.handModel1);
                    break;
                case 'Hand (Not working on Vive)':
                    this.controllerGrip1.remove(this.controllerModel1);
                    this.controllerGrip1.remove(this.markerModel1);
                    this.hand1.add(this.handModel1);
                    break;
                case 'Controller':
                default:
                    this.controllerGrip1.add(this.controllerModel1);
                    this.controllerGrip1.remove(this.markerModel1);
                    this.hand1.remove(this.handModel1);
            }
        }
        
        controllerVisSelect.value = "Controller";
        controllerVisSelect.onchange();

        let stereoToggle = document.querySelector('#stereo-toggle');
        stereoToggle.addEventListener('click', (e) => {
            this.renderer.xr.stereo = e.target.checked
        })

        let parallaxToggle = document.querySelector('#parallax-toggle');
        parallaxToggle.addEventListener('click', (e) => {
            this.renderer.xr.parallax = e.target.checked;
            this.renderer.xr.defaultPosition = this.defaultPosition;
        })

        let reGroundToggle = document.querySelector('#re-ground-toggle');
        reGroundToggle.addEventListener('click', (e) => {
            this.reGround4DoF = e.target.checked;
        })

        let axesHelper = new T.AxesHelper(5);
        window.robot.links.right_hand.add(axesHelper);
        let axesHelper2 = new T.AxesHelper(5);
        this.controllerGrip1.add(axesHelper2);

        const config = {
            image_marker: { type: "img", position: { left: 2, top: 2 }, width: 250 },
            image_tongs: { type: "img", position: { left: 254, top: 2 }, width: 250 },
            body: { backgroundColor: "#666", 
                    opacity: 0.7,
                    padding:0
                },
            panelSize: { width: 0.1, height: 0.025},
            opacity:  1.0,
            width: 1024,
            height: 256,
        }
        const content = {
            image_marker: "../images/marker.png",
            image_tongs: "../images/tongs.png"
        }
        const ui = new CanvasUI(content, config);

        ui.mesh.position.set( 0., -0.04, -0.12 );
        this.camera.add(ui.mesh);

    }

    squeeze() {
        if (Math.abs(Date.now() - this.lastSqueeze) > 300) {
            console.log('Reset robot pose')
            this.mouseControl.reset()
        } else {
            this.renderer.xr.stereo = !this.renderer.xr.stereo;
            console.log('Stereo: ' +  this.renderer.xr.stereo);
        }
        this.lastSqueeze = Date.now()
    }

    select() {
        if (this.controlMode) {
            this.controlMode = false;
            clearInterval(this.intervalID);

        } else {
            this.controlMode = true;
            let prev = this.getPose(this.controllerGrip1)

            this.intervalID = setInterval(() => {
                let curr = this.getPose(this.controllerGrip1)

                let x = (curr.x - prev.x) * this.scale
                let y = (curr.y - prev.y) * (this.scale / 370)
                let z = (curr.z - prev.z) * this.scale

                let r = new T.Quaternion();
                if (this.rel_rot) {
                    let q1 = prev.r.clone()
                    let q2 = curr.r.clone()
                    r.multiplyQuaternions(q2, q1.invert())
                } else {
                    r = curr.r.clone();
                }

                // in world space, y is up; in robot space, z is up
                this.mouseControl.onControllerMove(x, z, y, r, this.rel_rot)

                prev = curr
            }, 5);
        }
    }

    getPose(controller) {
        let controllerPos = controller.getWorldPosition(new T.Vector3())
        let controllerOri = controller.getWorldQuaternion(new T.Quaternion())
        return {
            x: controllerPos.x,
            y: controllerPos.y,
            z: controllerPos.z,
            r: controllerOri
        }
    }

    update() {
        // controllers not detected
        if (!this.vive_buttons) return;

        // https://stackoverflow.com/questions/62476426/webxr-controllers-for-button-pressing-in-three-js
	    //determine if we are in an xr session
        if (this.renderer.xr.getSession()) {
            if (this.vive_buttons.buttons[2].pressed){
                if (Math.abs(Date.now() - this.lastSqueeze) > 50) {
                    this.controlMode = false;
                    clearInterval(this.intervalID);
                    if (this.reGround4DoF) {
                        let eyePose = this.camera.matrixWorld.clone();
                        let userPose = this.userGroup.matrixWorld.clone();
                        let handPose = this.controllerGrip1.matrixWorld.clone();
                        let relHandPose = userPose.clone().invert().multiply( handPose);
                        let eePosi = new T.Vector3().setFromMatrixPosition(window.robot.links.right_hand.matrixWorld);
                        
                        let targetPose = new T.Matrix4().compose(eePosi, new T.Quaternion().setFromRotationMatrix(handPose), new T.Vector3(1., 1., 1.));
                        let newUserGroupPose = targetPose.clone().multiply(relHandPose.clone().invert());
                   
                        this.userGroup.position.setFromMatrixPosition( newUserGroupPose);
                        this.userGroup.quaternion.setFromRotationMatrix( newUserGroupPose);

                    } else { 
                        // 6DoF reground
                        let eyePose = this.camera.matrixWorld.clone();
                        let userPose = this.userGroup.matrixWorld.clone();
                        let handPose = this.controllerGrip1.matrixWorld.clone();
                        let relHandPose = userPose.clone().invert().multiply( handPose);
                        let eePose = window.robot.links.right_hand.matrixWorld.clone();
                        let eeToViveOffset = new T.Matrix4().makeRotationFromEuler(
                            new T.Euler(0., -1.57079632679, 1.57079632679)
                        );
                        let newUserGroupPose = eePose.clone().multiply(eeToViveOffset).multiply(relHandPose.clone().invert());
                        
                        this.userGroup.position.setFromMatrixPosition( newUserGroupPose);
                        this.userGroup.quaternion.setFromRotationMatrix( newUserGroupPose);

                    }
                   

                }
                this.lastTouchpad = Date.now()
            }
        }
    }
}

