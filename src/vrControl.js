/**
 * @author William Cong
 */

import * as T from 'three';
// import { degToRad, getCurrEEpose, mathjsMatToThreejsVector3 } from './utils';
import { CanvasUI } from './interfaces/WebXRCanvasUI'
import { Arsenal } from './arsenal';

export class VrControl {
    constructor(options) {

        this.renderer = options.renderer
        this.scene = options.scene
        this.camera = options.camera;
        this.intervalID = undefined;
        this.mouseControl = options.mouseControl
        this.controlMapping = options.controlMapping;
        this.scale = 20000

        this.lastSqueeze = 0;
        this.lastTouchpad = Date.now();
        this.defaultPosition = new T.Vector3();
        this.defaultPosition.set(1.5, 1.5, 0)

        // toggles robot control
        this.controlMode = false;
        this.reGround4DoF = true;

        // if true, send relative rotation (velocity) commend to relaxedik
        this.rel_rot = true;

        this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);

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

        this.arsenal = new Arsenal( {
            "controllerGrip": this.controllerGrip1,
            "camera": this.camera,
            "mouseControl": this.mouseControl
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
        window.robot.links.finger_tip.add(axesHelper);
        let axesHelper2 = new T.AxesHelper(5);
        this.controllerGrip1.add(axesHelper2);

    }

    squeeze() {
        if (Math.abs(Date.now() - this.lastSqueeze) > 300) {
            console.log('Reset robot pose');
            this.arsenal.robot_reset();
        } else {
            this.renderer.xr.stereo = !this.renderer.xr.stereo;
            console.log('Stereo: ' +  this.renderer.xr.stereo);
        }
        this.lastSqueeze = Date.now();
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

                this.arsenal.onControllerMove(x, z, y, r, this.rel_rot)

                prev = curr
            }, 5);
        }
    }
    
    gamepad_left() {
        this.arsenal.prev_tool();
    }
    
    gamepad_right() {
        this.arsenal.next_tool();
    }

    gamepad_backward() {
        if (window.taskControl)
            window.taskControl.finished();
    }
    
    gamepad_forward() {
        // re-ground
        let eyePose = this.camera.matrixWorld.clone();
        let userPose = this.userGroup.matrixWorld.clone();
        let handPose = this.controllerGrip1.matrixWorld.clone();
        let relHandPose = userPose.clone().invert().multiply( handPose);
        let eePosi = new T.Vector3().setFromMatrixPosition(window.robot.links.finger_tip.matrixWorld);

        let targetPose = new T.Matrix4().compose(eePosi, new T.Quaternion().setFromRotationMatrix(handPose), new T.Vector3(1., 1., 1.));
        let newUserGroupPose = targetPose.clone().multiply(relHandPose.clone().invert());

        this.userGroup.position.setFromMatrixPosition( newUserGroupPose);
        this.userGroup.quaternion.setFromRotationMatrix( newUserGroupPose);
    }
    
    gamepad_center() {
        console.log("center button pressed");
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
                if (Math.abs(Date.now() - this.lastTouchpad) > 300) {
                    // pause control
                    this.controlMode = false;
                    clearInterval(this.intervalID);
                    
                    // left
                    if (this.vive_buttons.axes[0] < -0.7 && Math.abs(this.vive_buttons.axes[1]) < 0.4) {
                        this.gamepad_left();
                    } else 
                    // right
                    if (this.vive_buttons.axes[0] > 0.7 && Math.abs(this.vive_buttons.axes[1]) < 0.4) {
                        this.gamepad_right();
                    } else
                    // backward
                    if (this.vive_buttons.axes[1] > 0.7 && Math.abs(this.vive_buttons.axes[0]) < 0.4) {
                        this.gamepad_backward();
                    } else
                    // forward
                    if (this.vive_buttons.axes[1] < -0.7 && Math.abs(this.vive_buttons.axes[0]) < 0.4) {
                        this.gamepad_forward();
                    } else
                    // center
                    {
                        this.gamepad_center();
                    }
                }
                this.lastTouchpad = Date.now()
            }
        }
    }
}

