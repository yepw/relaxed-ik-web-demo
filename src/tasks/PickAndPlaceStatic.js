/**
 * @author Yeping Wang 
 */

import * as T from 'three';
import { Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import Task from './Task'

import {
    getBrowser, T_THREE_to_ROS, T_ROS_to_THREE, Line3D, castShadow, rotQuaternion, changeReferenceFrame, quaternionToAxisAngle
} from "../utils.js";
import { setQuaternionFromProperEuler } from 'three/src/math/MathUtils';

export default class PickAndPlaceStatic extends Task {
    constructor(options) {
        super();

        this.browser = getBrowser();
        this.init_joint_angles = [0.04201808099852697 + 0.4, 0.11516517933728028, -2.1173004511959856, 1.1497982678125709, -1.2144663084736145, -2.008953561788951, 0.7504719405723105 + 0.4];
        this.bricks = [];
        this.gripper_occupied = false;
        this.scene = options.scene
    }

    nextRound() {
        for (const brick of this.bricks) {
            brick.draw();
        }
    } 

    // removes brick and target from the scene and array
    removeBricks() {
        for (const brick of this.bricks) {
            brick.remove()
        }
        this.bricks = [];
    }


    init() {
        if (window.kitchenDynamic)
            this.scene.add(window.kitchenDynamic);
        if (window.kitchenStandard)
            this.scene.add(window.kitchenStandard);
        if (window.kitchenStatic)
            this.scene.add(window.kitchenStatic); 
    }

    quit() {
        this.reset();
        this.scene.remove(window.kitchenDynamic);
        this.scene.remove(window.kitchenStandard);
        this.scene.remove(window.kitchenStatic);
    }

    reset() {
        this.removeBricks();
    }

    // this is called about every 5 ms
    update(ee_pose) {
        for (const brick of this.bricks) {
            brick.update(ee_pose);
            // if (ee_pose.posi.distanceTo(brick.brick.position) < 0.1) {
            //     brick.autoGrasp(ee_pose)
            // }
        }
    }
}