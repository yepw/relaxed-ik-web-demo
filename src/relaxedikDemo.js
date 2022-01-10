import * as T from 'three';
import URDFLoader from 'urdf-loader';
import { initScene } from './sceneInit';
import { getURDFFromURL } from './robotFunctions/loaderHelper';
import { recurseMaterialTraverse } from './robotFunctions/robotHelpers';
import { createSlider, createCanvas, createText, createToggleSwitch, createBr, createSelect, createButton } from './ui/inputAdders';

import { MouseControl } from './mouseControl.js';
import { VrControl } from './vrControl.js'

import init, {RelaxedIK} from "../relaxed_ik_web/pkg/relaxed_ik_web.js";
import * as yaml from 'js-yaml';
import { getCurrEEpose, changeReferenceFrame,
        T_ROS_to_THREE, T_THREE_to_ROS, } from './utils';

import { Euler } from 'three';

export function relaxedikDemo() {

    
    import('@dimforge/rapier3d').then(RAPIER => { // Use the RAPIER module here.
        let gravity = { x: 0.0, y: -9.81, z: 0.0 };
        let world = new RAPIER.World(gravity);

        // Create the ground
        let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 0.1, 10.0);
        world.createCollider(groundColliderDesc);

        let coll2mesh = new Map();

        let scene, camera, renderer, camControls, target_cursor;

        // Load robot
        let init_scene = initScene();
        scene = init_scene[0];
        camera = init_scene[1];
        renderer = init_scene[2];
        camControls = init_scene[3];
        camera.position.set(2, 2, 2);
        camera.lookAt(0, 1, 0);
    
        window.robot = {};
        window.vrControl = undefined;
        let jointSliders = [];
    
        let sawyerRobotFile; 
        getURDFFromURL("https://raw.githubusercontent.com/yepw/robot_configs/master/sawyer_description/urdf/sawyer_gripper.urdf", (blob) => {
            sawyerRobotFile = URL.createObjectURL(blob);
        });
    
        let ur5RobotFile;
        getURDFFromURL("ur5_description/urdf/ur5_gripper.urdf", (blob) => {
            ur5RobotFile = URL.createObjectURL(blob);
            robotSwitch.value = "UR5";
            robotSwitch.onchange();
        });
    
        createText("Introduction:", "inputs", "h3");
        createText("This is an online demo of Relaxed-IK.", "inputs", "p");
        createText("The yellow sphere visualizes position goals specified by a user. Purple objects are obstacles.", "inputs", "p");
    
        createBr("inputs");
        createBr("inputs");
    
        createText("How to control:", "inputs", "h3");
    
        createText("1. Click the red dot below.", "inputs", "p");
        createText("2. Move the mouse to control the robot.", "inputs", "p");
        createText("3. Scroll mouse wheel to move the robot up and down.", "inputs", "p");
        createText("4. Right-click to switch to rotation mode.", "inputs", "p");
        createText("5. Press the ESC button on your keyboard to unlock the cursor.", "inputs", "p");
    
        createBr("inputs");
        createBr("inputs");
    
        createToggleSwitch ("show-cursor", "inputs", "Hide", "Show Robot Goal", true);
    
        let robotSwitch = createSelect("robot", "Robot", "inputs", [
            'Sawyer',
            'UR5'
        ]);

        robotSwitch.onchange = function() {
            switch (robotSwitch.value) {
                case 'Sawyer':
                    loadRobot(sawyerRobotFile,
                        "https://raw.githubusercontent.com/yepw/robot_configs/master/info_files/sawyer_gripper_info.yaml",
                        "https://raw.githubusercontent.com/yepw/robot_configs/master/collision_nn_rust/sawyer_nn.yaml",
                        "https://raw.githubusercontent.com/yepw/robot_configs/master/sawyer_description/env_settings.yaml");
                    break;
                case 'UR5':
                    loadRobot(ur5RobotFile,
                        "https://raw.githubusercontent.com/yepw/robot_configs/master/info_files/ur5_gripper_info.yaml",
                        "https://raw.githubusercontent.com/yepw/robot_configs/master/collision_nn_rust/ur5_nn.yaml",
                        "https://raw.githubusercontent.com/yepw/robot_configs/master/ur5_description/env_settings.yaml");
                    break;
                default:
            }
        }

        createCanvas("mouse-control", "bottomDiv");

        let geometry = new T.SphereGeometry( 0.015, 32, 32 );
        let material = new T.MeshBasicMaterial( {color: 0xffff00} );
        target_cursor = new T.Mesh( geometry, material );
        scene.add( target_cursor );

        let loadRobot = (robotFile, robot_info_link, robot_nn_config_link, env_settings_link) => {
            if (window.robot)
                scene.remove(window.robot);
            const manager = new T.LoadingManager();
            const loader = new URDFLoader(manager);
            loader.parseCollision = true;
            loader.load(robotFile, result => {
                window.robot = result;
                console.log(window.robot);
            });
            manager.onLoad = () => {
                scene.add(window.robot);
                window.robot.rotation.x = -Math.PI / 2;
                window.robot.traverse(c => {
                    c.castShadow = true;
                    c.recieveShadow = true;
                    if (c.type == "PointLight") {
                        c.intensity = 0;
                        c.castShadow = false;
                        c.distance = 0;
                    }
                    if (c.material) {
                        recurseMaterialTraverse(c.material, (material) => {
                            material.alphaToCoverage = true;
                            material.transparent = true;
                            material.side = T.DoubleSide
                        })
                    }
                });

                let jointArr = Object.entries(window.robot.joints).filter(joint => joint[1]._jointType != "fixed" && joint[1].type != "URDFMimicJoint");
                jointArr.forEach(joint => {
                    let slider = createSlider(joint[0], "joints", joint[1].limit.lower, joint[1].limit.upper, 0.01, joint[1].jointValue[0]);

                    slider[0].oninput = () => {
                        slider[1].innerHTML = joint[0] + ": " + String(slider[0].value);
                        window.robot.setJointValue(joint[0], slider[0].value);
                    }
                    jointSliders.push(slider);
                })

                // relaxed-ik
                init().then( () => {
                    load_config(robot_info_link, robot_nn_config_link, env_settings_link);
                });

                let createRobotCollider = (currJoint, parentLink) => {
                    currJoint.forEach( (joint) => {
                        parent
                    })
                    // let bodyDesc = RAPIER.RigidBodyDesc.newDynamic().setTranslation(x, y, z);
                    // let body = world.createRigidBody(bodyDesc);
                    // let vertices = parent
                    // colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
                    // .setCollisionGroups(group);
                }

                createRobotCollider(window.robot);
            }
        }

        async function load_config(robot_info_link, robot_nn_config_link, env_settings_link) {
            let robot_info = yaml.load(await fetch(robot_info_link).then(response => response.text()));
            let robot_nn_config = yaml.load(await fetch(robot_nn_config_link).then(response => response.text()));
            let env_settings = yaml.load(await fetch(env_settings_link).then(response => response.text()));

            vis_env_collision(env_settings);

            // move robot to init config
            let jointArr = Object.entries(window.robot.joints).filter(joint => joint[1]._jointType != "fixed" && joint[1].type != "URDFMimicJoint");
            jointArr.forEach( joint => {
                let i = robot_info.joint_ordering.indexOf(joint[0]);
                if (i != -1) {
                    joint[1].jointValue[0] =  robot_info.starting_config[i];
                    let slider = jointSliders.find(element => element[0].id.trim() == `${joint[0]}-slider`);
                    slider[0].value = joint[1].jointValue[0];
                    slider[1].innerHTML = joint[0] + ": " + String(slider[0].value);
                    slider[0].oninput();
                }
            })    

            let relaxedIK = new RelaxedIK(robot_info, robot_nn_config, env_settings);
            
            window.mouseControl = new MouseControl({
                relaxedIK: relaxedIK,
                jointSliders: jointSliders,
                robot_info: robot_info,
                target_cursor: target_cursor
            });

            setInterval( function(){ 
                window.mouseControl.step();
            }, 5);

            window.vrControl = new VrControl({
                renderer,
                scene,
                camera,
                relaxedIK
            });
        }

        function vis_env_collision(env_settings) {
            const material = new T.MeshBasicMaterial( { color: 0xff00ff } );
            material.transparent = true;
            material.opacity = 0.6;
            if (env_settings.spheres) {
                env_settings.spheres.forEach( (sphere) => {
                    const geometry = new T.SphereGeometry(sphere.scale, 32, 16);
                    const mesh = new T.Mesh( geometry, material );
                    let x = sphere.translation[0];
                    let y = sphere.translation[1];
                    let z = sphere.translation[2] + 0.9;
                    let pose_ros = {"posi": new T.Vector3(x, y, z),
                                    "ori": new T.Quaternion()};
                    let pose_three = changeReferenceFrame(pose_ros, T_THREE_to_ROS);
                    mesh.position.copy(pose_three.posi);
                    scene.add (mesh);

                    // for physics engine
                    let bodyDesc = RAPIER.RigidBodyDesc.newDynamic().setTranslation(pose_three.posi.x, pose_three.posi.y, pose_three.posi.z);
                    let body = world.createRigidBody(bodyDesc);
                    let colliderDesc = RAPIER.ColliderDesc.ball(sphere.scale);
                    let collider = world.createCollider(colliderDesc, body.handle);

                    coll2mesh.set(collider, mesh)
                })
            }
            if (env_settings.cuboids) {
                env_settings.cuboids.forEach( (cuboid) => {
                    const geometry = new T.BoxGeometry(cuboid.scale[0], cuboid.scale[2], cuboid.scale[1]);
                    const mesh = new T.Mesh( geometry, material );
                    let pose_ros = {"posi": new T.Vector3(cuboid.translation[0], cuboid.translation[1], cuboid.translation[2] + 0.9),
                                    "ori": new T.Quaternion().setFromEuler(new Euler(
                                        cuboid.rotation[0], cuboid.rotation[1], cuboid.rotation[2]
                                    ))};
                    let pose_three = changeReferenceFrame(pose_ros, T_THREE_to_ROS);
                    mesh.position.copy(pose_three.posi);
                    mesh.quaternion.copy(pose_three.ori);
                    scene.add (mesh);

                    // for physics engine
                    let colliderDesc = RAPIER.ColliderDesc.cuboid(cuboid.scale[0], cuboid.scale[2], cuboid.scale[1]).setTranslation(pose_three.posi.x, pose_three.posi.y, pose_three.posi.z);
                    let collider = world.createCollider(colliderDesc);

                    coll2mesh.set(collider, mesh)
                })
            }
        }

        renderer.setAnimationLoop( function () {
            renderer.render( scene, camera );
            if (window.vrControl)
                window.vrControl.update();
        
        } );
      
      
        // Game loop. Replace by your own game loop system.
        let gameLoop = () => {
            // Ste the simulation forward.  
            world.step();
            coll2mesh.forEach((mesh, collider) => {
                let position = collider.translation();
                mesh.position.set(position.x, position.y, position.z);
                // mesh.quaternion.set(collider.rotation.x, collider.rotation.y, collider.rotation.z, collider.rotation.w);
                mesh.updateMatrix();
            })
            setTimeout(gameLoop, 16);
        };
      
        gameLoop();
    })

}

