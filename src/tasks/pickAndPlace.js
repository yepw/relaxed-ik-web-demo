/**
 * @author Yeping Wang 
 */

import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import {
    getBrowser, T_THREE_to_ROS, T_ROS_to_THREE, Line3D, castShadow, rotQuaternion, changeReferenceFrame, quaternionToAxisAngle
} from "../utils.js";

export class Brick {
    constructor(options) {
        this.init_posi = options.init_posi;
        this.init_angle = options.init_angle;

        this.curr_posi = this.init_posi;

        this.target_posi = options.target_posi;
        this.scene = options.scene;

        this.drawn = false;

        let height = 0.08;
        this.handle_offset = new T.Vector3(0, 0, height/2);
        this.bottom_offset = new T.Vector3(0, 0, -height/2);
        {
            let geometry = new T.BoxGeometry( 0.03, height, 0.03, 32, 32, 32 );
            let material = new T.MeshStandardMaterial( {color: options.color} );
            this.brick = new T.Mesh( geometry, material );
            this.brick.castShadow = true;
            this.brick.receiveShadow = true;
        }
        this.reset();
        if (options.target_object == "circle")  {

            const geometry = new T.TorusGeometry( 0.05, 0.005, 64, 64);
            const material = new T.MeshBasicMaterial( { color: options.color } );
            const mesh = new T.Mesh( geometry, material );

            this.target = new T.Group();
            this.target.name = "circle";
            this.target.add(mesh);
            this.target.position.copy(options.target_posi);
            this.target.rotation.x = Math.PI/2;
            this.target.castShadow = true;
            this.target.receiveShadow = true;

        } else if (options.target_object == "box") {
            let geometry = new T.BoxGeometry( 0.07, 0.07, box_height , 32, 32, 32 );
            let material = new T.MeshStandardMaterial( {color: options.box_color} );
      
            this.target = new T.Mesh( geometry, material );
            this.target.name = "box";
            this.target.position.set( options.target_posi.x,
                                      options.target_posi.y, 
                                      options.target_posi.z - options.box_height/2);
            this.target.castShadow = true;
            this.target.receiveShadow = true;
        }
    }

    updatePose() {
        this.brick.position.copy( this.curr_posi );
        this.brick.rotation.z =  this.curr_angle; 
        this.brick.updateMatrixWorld();
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
        this.curr_posi = this.init_posi;
        this.curr_angle = this.init_angle;
        this.updatePose();
    }

    remove() {
        this.scene.remove(this.brick);
        this.scene.remove(this.target);
        this.drawn = false;
    }
    

    autoGrasp(ee_pose, gripper_occupied) {
        console.log('GRABBED')

        this.curr_posi = ee_pose.posi;

        this.brick.position.copy( ee_pose.posi );
        this.brick.quaternion.copy( ee_pose.ori );

        if (this.curr_posi.distanceTo(this.target_posi) < 0.02) {
            window.taskControl.finished();
        }

    //     if (this.grasped) {
    //         if (!this.released) {
    //             this.curr_posi = ee_posi.add(this.handle_offset.clone().negate());
    //             this.updatePosi();
    //             let d = this.curr_posi.clone().add( this.bottom_offset).distanceTo(this.target_posi);
    //             if (document.getElementById("dist-tar-span"))
    //                 document.getElementById("dist-tar-span").innerHTML = `0`;
    //             if ( d > window.study.max_d_before_pick) 
    //                 window.study.max_d_before_pick = `${d} m` ;
    //             if ( d < 0.02) {
    //                 this.released = true;
    //                 if (window.study.finished)
    //                     window.study.finished();
    //                 return false;
    //             }
    //             return true;
    //         } 
    //     } else {
    //         if (!gripper_occupied) {
    //             let d = this.curr_posi.clone().add( this.handle_offset).distanceTo(ee_posi); 
    //             if (document.getElementById("dist-tar-span"))
    //                 document.getElementById("dist-tar-span").innerHTML = `${(d*100).toFixed(0)}`;
    //             if (d > window.study.max_d_after_pick) 
    //                 window.study.max_d_after_pick =  `${d} m` ;
    //             if ( d < 0.02) {
    //                 this.grasped = true;
    //                 this.grasp_offset =  this.curr_posi.clone().add( ee_posi.clone().negate());
    //                 return true;
    //             }
    //             return false;
    //         }
    //     }
    }
}

export class PickAndPlaceBricksTabletop {
    constructor(options) {
        this.browser = getBrowser();
        // this.init_joint_angles = options.init_joint_angles ?? [0.04201808099852697 + 0.4, 0.11516517933728028, -2.1173004511959856, 1.1497982678125709, -1.2144663084736145, -2.008953561788951, 0.7504719405723105 + 0.4];
        this.init_joint_angles = [0.04201808099852697 + 0.4, 0.11516517933728028, -2.1173004511959856, 1.1497982678125709, -1.2144663084736145, -2.008953561788951, 0.7504719405723105 + 0.4];
        this.bricks = [];
        this.gripper_occupied = false;
        this.scene = options.scene
    }

    // countCollision() {
    //     let that = this;
    //     new ROS3D.SceneNode({
    //         frameID: window.robot_ns + "/right_hand",
    //         tfClient: window.tfClient,
    //         object: undefined,
    //         tfCallback: function (pose) {
    //             let collide = false;
    //             let offset;
    //             if (that.gripper_occupied) offset = 0.17;
    //                                 else offset = 0.12;
    //             let ee_offset = new T.Vector3(0, 0., offset).applyQuaternion(
    //                 new T.Quaternion(pose.orientation.x,
    //                                     pose.orientation.y,
    //                                     pose.orientation.z,
    //                                     pose.orientation.w));
    //             let ee_posi = new T.Vector3( pose.position.x, 
    //                             pose.position.y, 
    //                             pose.position.z ).add(ee_offset);
              
    //             // colliding with table
    //             if ( ee_posi.z < 0.75)
    //                 collide = true;
                
    //             // collding with the larger brick
    //             for (let i=0; i<that.bricks.length; i++) {
    //                 let brick = that.bricks[i];
    //                 if (brick.target.name === 'brick') {
    //                     if ( ee_posi.z < 0.75 + brick.target.geometry.parameters.depth ) {
    //                         let x_sign = [1, 1, -1, -1];
    //                         let y_sign = [1, -1, 1, -1];
    //                         for (let i =0; i<4; i++) {
    //                             let x = ee_posi.x + x_sign[i] * brick.brick.geometry.parameters.width / 2;
    //                             let y = ee_posi.y + y_sign[i] * brick.brick.geometry.parameters.width / 2;
    //                             let d_x = Math.abs( x - brick.target_posi.x);
    //                             let d_y = Math.abs( y - brick.target_posi.y);
    //                             if (d_x < brick.target.geometry.parameters.width/2 && d_y < brick.target.geometry.parameters.width/2 ) {
    //                                 collide = true;
    //                                 break;
    //                             }
    //                         }
    //                     }
    //                 }
    //             }

    //             if (window.task_state === "started" && collide) {
    //                 document.getElementById("error_sound").play();
    //             }
    //         }
    //     });
    // }

    // autoGrasp() {
    //     let that = this;
    //     this.autoGraspNode = new ROS3D.SceneNode({
    //         frameID: window.robot_ns + "/right_hand",
    //         tfClient: window.tfClient,
    //         object: undefined,
    //         tfCallback: function (pose) {
    //             if (!that.grasped) {
    //                 let ee_offset = new T.Vector3 (0., 0., 0.10).applyQuaternion(
    //                     new T.Quaternion(pose.orientation.x,
    //                                         pose.orientation.y,
    //                                         pose.orientation.z,
    //                                         pose.orientation.w));
    //                 let ee_posi = new T.Vector3( pose.position.x, 
    //                                 pose.position.y, 
    //                                 pose.position.z ).add(ee_offset);
    //                 for (let i=0; i<that.bricks.length; i++) {
    //                     that.gripper_occupied = that.bricks[i].autoGrasp(ee_posi, that.gripper_occupied);
    //                 }
    //             }
    //         }
    //     });
    // }

    // removeAutoGrasp() {
    //     // this.autoGraspNode.unsubscribeTf();
    // }

    // postInstruct(s) {
    //     document.getElementById("instruction-div").innerHTML = s;
    // }

    // userClickRedDot() {
    //     window.task_state = "started";
    // }

    pubTaskPrepare() {

        console.log(this.bricks)
        // let msg;
        // msg = new ROSLIB.Message({
        //     position: this.init_joint_angles
        // });
        // window.rosServer.task_prepare_publisher.publish(msg);
        // window.task_state = "prepared";
        
        for (let i=0; i<this.bricks.length; i++) {
            this.bricks[i].draw();
        }
    }

    loadModels() {
        if (window.kitchenDynamic)
            this.scene.add(window.kitchenDynamic);
        if (window.kitchenStandard)
            this.scene.add(window.kitchenStandard);
        if (window.kitchenStatic)
            this.scene.add(window.kitchenStatic);
    }

    removeBricks() {
        for (let i=0; i<this.bricks.length; i++) 
            this.bricks[i].remove();
    }

    removeModels() {
        // this.removeTable();
        this.scene.remove(window.kitchenDynamic);
        this.scene.remove(window.kitchenStandard);
        this.scene.remove(window.kitchenStatic);
        this.removeBricks();
        // this.removeAutoGrasp();
    }

    // userHitESC() {
    //     this.pubTaskPrepare();
    //     if (window.penCurve)
    //         window.penCurve.remove();
    // }

    init() {
        // this.pubTaskPrepare();
        this.loadModels();
    }

    quit() {
        this.removeModels();
    }

    update(ee_pose) {
        for (let i=0; i<this.bricks.length; i++) {
            // console.log(this.bricks[i].brick.position)
            if (ee_pose.posi.distanceTo(this.bricks[i].brick.position) < 0.1) {
                this.bricks[i].autoGrasp(ee_pose)
            }
        }

    }

    // drawTable() {
    //     if (!window.table) {
    //         const loader = new GLTFLoader();
    //         window.table = new T.Group()
    //         loader.load(
    //             '../models/table/scene.gltf',
    //             function (gltf) {
    //                 let table = gltf.scene;
    //                 let scale = 0.00925;
    //                 table.scale.set(scale, scale, scale);
    //                 table.rotateY(Math.PI / 2); // up
    //                 // table.rotateZ(Math.PI / 2);
    //                 table.position.x = 0.6;
    //                 // table.position.y = 0.2;
    //                 // table.position.z = .3;
    //                 castShadow(table);	
    //                 table.children[0].castShadow = true;
    //                 table.children[0].receiveShadow = true;
    //                 window.table.add(table);
    //             },
    //             function (xhr) {
    //                 console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    //             },
    //             function (error) {
    //                 console.log('An error happened when loading gltf: ' + error);
    //             }
    //         );
    //         this.scene.add(window.table);
    //     } else {
    //         this.scene.add(window.table);
    //     }
    // }

    // removeTable() {
    //     if (window.table)
    //         this.scene.remove(window.table);
    // }

   
}