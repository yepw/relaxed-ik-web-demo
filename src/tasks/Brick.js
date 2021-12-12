import * as T from 'three';
import { rotQuaternion } from "../utils.js";
import { EE_TO_GRIPPER_OFFSET, EE_TO_THREE_ROT_OFFSET } from "./globals"

const TABLE_HEIGHT = 1.05;

export default class Brick {
    constructor(options) {
        this.init_posi = (options.init_posi.y += TABLE_HEIGHT, options.init_posi);
        this.init_angle = options.init_angle;
        this.target_posi = (options.target_posi.y += TABLE_HEIGHT, options.target_posi);
        this.scene = options.scene;
        this.target_vel = options.target_vel;

        this.clock = new T.Clock({ autoStart: false });

        this.curr_posi = this.init_posi;

        this.drawn = false;

        const HEIGHT = 0.08;
        this.handle_offset = new T.Vector3(0, 0, HEIGHT/2);
        this.bottom_offset = new T.Vector3(0, 0, -HEIGHT/2);

        // create the brick
        const height = options.brick_dimensions?.height ?? 0.03;
        this.brick = new T.Mesh( 
            new T.BoxGeometry( 
                options.brick_dimensions?.width ?? 0.03,
                height,
                options.brick_dimensions?.depth ?? 0.03,
                1, 1, 1 
            ),
            new T.MeshStandardMaterial({ color: options.color })
        );

        this.init_posi.y += height / 2;
        this.brick.castShadow = true;
        this.brick.receiveShadow = true;

        // create the target
        switch(options.target_object) {
            case 'circle':
                const mesh = new T.Mesh( 
                    new T.TorusGeometry( 0.05, 0.005, 64, 64),
                    new T.MeshBasicMaterial( { color: options.color } )
                );
                this.target = new T.Group();
                this.target.add(mesh);
                this.target.name = "circle";
                this.target_posi.y += 0.005;
                this.target.position.copy(this.target_posi);
                this.target.rotation.x = Math.PI/2;
                break;

            case 'box':
                // this.target = new T.Mesh( 
                //     new T.BoxGeometry( 0.07, 0.07, box_height , 32, 32, 32 ),
                //     new T.MeshStandardMaterial( {color: options.box_color} ) 
                // );
                // this.target.name = "box";
                // this.target_posi.y 
                // this.target.position.set( 
                //     this.target_posi.x,
                //     this.target_posi.y, 
                //     this.target_posi.z - options.box_height/2
                // );
                break;

            default:
                console.log('ERROR: Unknown target object');
                break;
        }

        this.target.castShadow = true;
        this.target.receiveShadow = true;

        this.reset();
    }


    draw() {
        if (this.drawn) {
            this.reset();
        } else {
            this.scene.add(this.brick);
            this.scene.add(this.target);
            this.drawn = true;
        }
    }

    reset() {
        this.grasped = false;
        this.released = false;
        this.grasp_offset = undefined;

        this.brick.position.copy(this.init_posi);
        this.brick.rotation.z = this.init_angle; 

        this.brick.updateMatrixWorld();
    }

    remove() {
        this.scene.remove(this.brick);
        this.scene.remove(this.target);
        this.drawn = false;
    }

    // called about every 5 ms
    update(ee_pose) {

        if (!this.clock.running) {
            this.clock.start();
            return;
        }

        // object representing gripper in Three space
        const gripper = new T.Object3D();
        gripper.position.copy(new T.Vector3(ee_pose.posi.x, ee_pose.posi.y, ee_pose.posi.z));
        gripper.quaternion.copy(new T.Quaternion(ee_pose.ori.x, ee_pose.ori.y, ee_pose.ori.z, ee_pose.ori.w));
        gripper.quaternion.multiply(EE_TO_THREE_ROT_OFFSET)
        gripper.translateX(EE_TO_GRIPPER_OFFSET);

        if (!this.grasped && gripper.position.distanceTo(this.brick.position) < 0.02) {
            console.log('Brick grabbed')
            this.grasped = true;
        }

        if (this.grasped) {
            this.brick.position.copy( gripper.position );
            this.brick.quaternion.copy( gripper.quaternion );
        }

        if (this.brick.position.distanceTo(this.target.position) < 0.02) {
            window.taskControl.finishRound();
        }

        this.brick.updateMatrixWorld();

        if (this.target_vel) {
            if (this.target_vel.z < 0 && this.target.position.z <= -1) {
                this.target_vel.negate(); 
            }

            if (this.target_vel.z > 0 && this.target.position.z >= 1) {
                this.target_vel.negate();
            }
            this.target.position.add(this.target_vel.clone().multiplyScalar(this.clock.getDelta()));
        }

    }
}
