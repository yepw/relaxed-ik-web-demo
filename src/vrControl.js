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
        this.defaultPosition = new T.Vector3();
        this.defaultPosition.set(1.5, 1.5, 0)
1
        // toggles robot control
        this.controlMode = false;

        this.controller1 = this.renderer.xr.getController(0); 
        this.controllerGrip1 = this.renderer.xr.getControllerGrip(0);
        const controllerModelFactory = new XRControllerModelFactory()
        this.model1 = controllerModelFactory.createControllerModel(this.controllerGrip1);
        this.controllerGrip1.add(this.model1);
        this.scene.add( this.controllerGrip1 );

        this.cameraGroup = new T.Group()
        this.cameraGroup.add(this.camera)
        this.scene.add(this.cameraGroup)

        this.select = this.select.bind(this);
        this.squeeze = this.squeeze.bind(this);

        this.controller1.addEventListener('select', this.select.bind(this));
        this.controller1.addEventListener('squeeze', this.squeeze.bind(this))

        let stereoToggle = document.querySelector('#stereo-toggle');
        stereoToggle.addEventListener('click', (e) => {
            this.renderer.xr.stereo = e.target.checked
        })

        let parallaxToggle = document.querySelector('#parallax-toggle');
        parallaxToggle.addEventListener('click', (e) => {
            this.renderer.xr.parallax = e.target.checked;
            this.renderer.xr.defaultPosition = this.defaultPosition;
        })
        
    }

    squeeze() {
        if (Math.abs(Date.now() - this.lastSqueeze) < 300) {
            console.log('Reset robot pose')
            this.mouseControl.reset()
        } else {
            // this.renderer.xr.stereo = !this.renderer.xr.stereo
            // console.log('Stereo: ' +  this.renderer.xr.stereo)
            let headPose = this.cameraGroup.matrixWorld.clone();
            let handPose = this.controller1.matrixWorld.clone();
            let relHandPose = headPose.clone().invert().multiply( handPose);
            let newCamPose = window.robot.links.right_hand.matrixWorld.clone().multiply(relHandPose.clone().invert());
            console.log(this.cameraGroup.matrixWorld);
            this.cameraGroup.matrixWorld.copy( newCamPose);
            console.log(this.cameraGroup.matrixWorld);

            this.matrixWorldNeedsUpdate = true;
        }
        this.lastSqueeze = Date.now()
    }

    select() {
        if (this.controlMode) {
            this.controlMode = false;
            clearInterval(this.intervalID);
        } else {
            this.controlMode = true;
            let prev = this.getPose(this.controller1)
            this.intervalID = setInterval(() => {
                let curr = this.getPose(this.controller1)

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
}

