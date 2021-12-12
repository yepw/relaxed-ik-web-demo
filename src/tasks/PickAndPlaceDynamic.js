/**
 * @author William Cong
 */

import * as T from 'three';
import Task from './Task'
import Brick from './Brick'

import {
    getBrowser, T_THREE_to_ROS, T_ROS_to_THREE, Line3D, castShadow, rotQuaternion, changeReferenceFrame, quaternionToAxisAngle
} from "../utils.js";
import { setQuaternionFromProperEuler } from 'three/src/math/MathUtils';

export default class PickAndPlaceDynamic extends Task {
    constructor(options) {
        super();

        this.browser = getBrowser();
        this.init_joint_angles = [0.04201808099852697 + 0.4, 0.11516517933728028, -2.1173004511959856, 1.1497982678125709, -1.2144663084736145, -2.008953561788951, 0.7504719405723105 + 0.4];
        this.bricks = [];
        this.gripper_occupied = false;
        this.scene = options.scene
        this.finished = false;

        // for the position values below, y = 0 is set at the height of the table
        this.rounds = [
            new Brick({
                brick_dimensions: {
                    width: this.getRandom(.03, .06),
                    height: this.getRandom(.03, .10),
                    depth: this.getRandom(.03, .06)
                },
                init_posi: new T.Vector3(
                    this.getRandom(0.6, 1.2), 
                    0, 
                    this.getRandom(-0.5, 0.5)
                ),
                init_angle: 0,
                target_posi: new T.Vector3(
                    this.getRandom(0.6, 1.2), 
                    0, 
                    this.getRandom(-0.5, 0.5)
                ),
                color: 0xFF0000,
                target_object: "circle",
                scene: this.scene
            }),
            new Brick({ 
                brick_dimensions: {
                    width: this.getRandom(.03, .06),
                    height: this.getRandom(.03, .10),
                    depth: this.getRandom(.03, .06)
                },
                init_posi: new T.Vector3(
                    this.getRandom(0.6, 1.2), 
                    0, 
                    this.getRandom(-0.5, 0.5)
                ),
                init_angle: 0, 
                target_posi: new T.Vector3(
                    this.getRandom(0.6, 1.2), 
                    0, 
                    this.getRandom(-0.5, 0.5)
                ),
                color: 0xdddd88, 
                target_object: "circle",
                scene: this.scene
            }),
            new Brick({
                brick_dimensions: {
                    width: this.getRandom(.03, .06),
                    height: this.getRandom(.03, .10),
                    depth: this.getRandom(.03, .06)
                },
                init_posi: new T.Vector3(
                    this.getRandom(0.6, 1.2), 
                    0, 
                    this.getRandom(-0.5, 0.5)
                ),
                init_angle: 0, 
                target_posi: new T.Vector3(
                    this.getRandom(0.6, 1.2), 
                    0, 
                    this.getRandom(-0.5, 0.5)
                ),
                color: 0xFF0000, 
                target_object: "circle",
                scene: this.scene
            })
        ]
    }

    getRandom(min, max) {
        return (Math.random() * (max - min) + min);
    }

    // draws the current state/round to the scene
    draw() {
        for (const brick of this.bricks) {
            brick.draw();
        }
    }

    setRound(num) {

        // this assums that a round consists of only 1 brick
        this.bricks.push(this.rounds[num]);

        this.draw();
    } 

    // removes brick and target from the scene and array
    removeBricks() {
        for (const brick of this.bricks) {
            brick.remove()
        }
        this.bricks = [];
    }

    // removeModels() {
    //     this.removeBricks();
    // }

    init() { }

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