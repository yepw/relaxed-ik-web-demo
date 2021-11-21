/**
 * @author William Cong
 */

import * as T from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
// import { degToRad, getCurrEEpose, mathjsMatToThreejsVector3 } from './utils';


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

        this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);
        const controllerModelFactory = new XRControllerModelFactory()
        this.model1 = controllerModelFactory.createControllerModel(this.controllerGrip1);
        this.controllerGrip1.add(this.model1);

        this.userGroup = new T.Group();
        this.userGroup.name = "user_group";
        this.userGroup.add(this.camera);
        this.userGroup.add(this.controllerGrip1);
        this.scene.add(this.userGroup);

        this.select = this.select.bind(this);
        this.squeeze = this.squeeze.bind(this);

        this.controllerGrip1.addEventListener('select', this.select.bind(this));
        this.controllerGrip1.addEventListener('squeeze', this.squeeze.bind(this));
        let that = this;
        this.controllerGrip1.addEventListener('connected', (e) => {
            that.vive_buttons = e.data.gamepad;
        })

        let stereoToggle = document.querySelector('#stereo-toggle');
        stereoToggle.addEventListener('click', (e) => {
            this.renderer.xr.stereo = e.target.checked
        })

        let parallaxToggle = document.querySelector('#parallax-toggle');
        parallaxToggle.addEventListener('click', (e) => {
            this.renderer.xr.parallax = e.target.checked;
            this.renderer.xr.defaultPosition = this.defaultPosition;
        })

        let axesHelper = new T.AxesHelper(5);
        window.robot.links.right_hand.add(axesHelper);
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
                let q1 = prev.r.clone()
                let q2 = curr.r.clone()
                r.multiplyQuaternions(q2, q1.invert())

                // in world space, y is up; in robot space, z is up
                this.mouseControl.onControllerMove(x, z, y, r)

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
                if (Math.abs(Date.now() - this.lastSqueeze) > 100) {
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
                this.lastTouchpad = Date.now()
            }
        }
    }
}

