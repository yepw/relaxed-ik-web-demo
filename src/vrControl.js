/**
 * @author William Cong
 */

import * as T from 'three';
// import { degToRad, getCurrEEpose, mathjsMatToThreejsVector3 } from './utils';

export class VrControl {
    constructor(options) {

        this.renderer = options.renderer
        this.scene = options.scene
        this.camera = options.camera;
        this.intervalID = undefined;
        this.mouseControl = window.mouseControl

        this.lastSqueeze = 0;
        this.lastTouchpad = Date.now();
        this.defaultPosition = new T.Vector3();
        this.defaultPosition.set(1.5, 1.5, 0)

        // toggles robot control
        this.controlMode = false;
        this.reGround4DoF = true;

        // if true, send relative rotation (velocity) commend to relaxedik
        this.rel_rot = true;

        this.controllerGrip = this.renderer.xr.getControllerGrip(0);

        this.userGroup = new T.Group();
        this.userGroup.name = "user_group";
        this.userGroup.add(this.camera);
        this.userGroup.add(this.controllerGrip);
        this.scene.add(this.userGroup);

        this.select = this.select.bind(this);
        this.squeeze = this.squeeze.bind(this);

        this.controllerGrip.addEventListener('select', this.select.bind(this));
        this.controllerGrip.addEventListener('squeeze', this.squeeze.bind(this));
        let that = this;
        this.controllerGrip.addEventListener('connected', (e) => {
            that.vive_buttons = e.data.gamepad;
        })
    }

    squeeze() {
        if (Math.abs(Date.now() - this.lastSqueeze) > 300) {
            console.log('Reset robot pose');
            this.mouseControl.reset();
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
            let prev = this.getPose(this.controllerGrip)

            this.intervalID = setInterval(() => {
                let curr = this.getPose(this.controllerGrip)

                let x = (curr.x - prev.x);
                let y = (curr.y - prev.y);
                let z = (curr.z - prev.z);

                let r = new T.Quaternion();
                if (this.rel_rot) {
                    let q1 = prev.r.clone();
                    let q2 = curr.r.clone();
                    r.multiplyQuaternions(q2, q1.invert());
                } else {
                    r = curr.r.clone();
                }

                this.arsenal.onControllerMove(x, z, y, r)

                prev = curr
            }, 5);
        }
    }
    
    gamepad_left() {
        console.log("gamepad left pressed");
    }
    
    gamepad_right() {
        console.log("gamepad right pressed");
    }

    gamepad_backward() {
        if (window.taskControl)
            window.taskControl.finishRound();
    }
    
    gamepad_forward() {
        // re-ground
        let eyePose = this.camera.matrixWorld.clone();
        let userPose = this.userGroup.matrixWorld.clone();
        let handPose = this.controllerGrip.matrixWorld.clone();
        let relHandPose = userPose.clone().invert().multiply( handPose);
        let eePosi = new T.Vector3().setFromMatrixPosition(window.robot.links.finger_tip.matrixWorld);

        let targetPose = new T.Matrix4().compose(eePosi, new T.Quaternion().setFromRotationMatrix(handPose), new T.Vector3(1., 1., 1.));
        let newUserGroupPose = targetPose.clone().multiply(relHandPose.clone().invert());

        this.userGroup.position.setFromMatrixPosition( newUserGroupPose);
        this.userGroup.quaternion.setFromRotationMatrix( newUserGroupPose);
    }
    
    gamepad_center() {
        console.log("gamepad center pressed");
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

