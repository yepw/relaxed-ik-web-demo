import * as T from 'three';
import URDFLoader from 'urdf-loader';
import { initScene } from './sceneInit';
import { getURDFFromURL } from './robotFunctions/loaderHelper';
import { recurseMaterialTraverse } from './robotFunctions/robotHelpers';
import { createSlider, createCanvas, createText, createToggleSwitch, createBr, createSelect, createButton } from './ui/inputAdders';

import { MouseControl } from './mouseControl.js';
import { VrControl } from './vrControl.js'

import init, {RelaxedIK} from "../relaxed_ik_core/pkg/relaxed_ik_core.js";
import * as yaml from 'js-yaml';
import { getCurrEEpose, changeReferenceFrame,
        T_ROS_to_THREE, T_THREE_to_ROS, } from './utils';

import { Euler } from 'three';

export function relaxedikDemo() {

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
    window.obstacles = [];
    window.vrControl = undefined;
    let jointSliders = [];

    let sawyerRobotFile; 
    getURDFFromURL("https://raw.githubusercontent.com/yepw/robot_configs/master/relaxed_ik_web_demo/sawyer_description/urdf/sawyer_gripper.urdf", (blob) => {
        sawyerRobotFile = URL.createObjectURL(blob);
        robotSwitch.value = "UR5";
        robotSwitch.onchange();
    });

    let ur5RobotFile;
    getURDFFromURL("https://raw.githubusercontent.com/yepw/robot_configs/master/relaxed_ik_web_demo/ur5_description/urdf/ur5_gripper.urdf", (blob) => {
        ur5RobotFile = URL.createObjectURL(blob)
    });

    let spotArmRobotFile;
    getURDFFromURL("https://raw.githubusercontent.com/yepw/robot_configs/master/relaxed_ik_web_demo/spot_arm_description/urdf/spot_arm.urdf", (blob) => {
        spotArmRobotFile = URL.createObjectURL(blob)
    });

    createText("Introduction:", "inputs", "h3");
    createText("This is an online demo of Relaxed-IK.", "inputs", "p");
    createText("The yellow sphere visualizes position goals specified by a user. Purple objects are obstacles.", "inputs", "p");

    createBr("inputs");

    createText("Control with a Mouse:", "inputs", "h3");

    createText("1. Click the red dot below.", "inputs", "p");
    createText("2. Move the mouse to control the robot.", "inputs", "p");
    createText("3. Scroll the mouse wheel to move up and down.", "inputs", "p");
    createText("4. Right-click to switch to the rotation mode.", "inputs", "p");
    createText("5. Press the ESC button on your keyboard to unlock the cursor.", "inputs", "p");

    createBr("inputs");

    createText("Try the Demo in VR:", "inputs", "h3");

    createText("If you are using HTC Vive", "inputs", "p");
    createText("1. Launch SteamVR", "inputs", "p");
    createText("2. Click the Enter VR button on this page", "inputs", "p");
    createText("3. Press the trigger on the VR controller to start", "inputs", "p");
    
    createBr("inputs");

    createToggleSwitch ("show-cursor", "inputs", "Hide", "Show Robot Goal", true);

    let robotSwitch = createSelect("robot", "Robot", "inputs", [
        'Sawyer',
        'UR5',
        'Spot Arm'
    ]);

    robotSwitch.onchange = function() {
        switch (robotSwitch.value) {
            case 'Sawyer':
                loadRobot(sawyerRobotFile,
                    "https://raw.githubusercontent.com/yepw/robot_configs/master/relaxed_ik_web_demo/settings/sawyer.yaml",
                    "https://raw.githubusercontent.com/yepw/robot_configs/master/relaxed_ik_web_demo/sawyer_description/urdf/sawyer_gripper.urdf");
                break;
            case 'UR5':
                loadRobot(ur5RobotFile,
                    "https://raw.githubusercontent.com/yepw/robot_configs/master/relaxed_ik_web_demo/settings/ur5.yaml",
                    "https://raw.githubusercontent.com/yepw/robot_configs/master/relaxed_ik_web_demo/ur5_description/urdf/ur5_gripper.urdf");
                break;
            case 'Spot Arm':
                loadRobot(spotArmRobotFile,
                    "https://raw.githubusercontent.com/yepw/robot_configs/master/relaxed_ik_web_demo/settings/spot_arm.yaml",
                    "https://raw.githubusercontent.com/yepw/robot_configs/master/relaxed_ik_web_demo/spot_arm_description/urdf/spot_arm.urdf");
                break;
            default:
        }
    }

    createCanvas("mouse-control", "bottomDiv");

    let geometry = new T.SphereGeometry( 0.015, 32, 32 );
    let material = new T.MeshBasicMaterial( {color: 0xffff00} );
    target_cursor = new T.Mesh( geometry, material );
    scene.add( target_cursor );

    let loadRobot = (robotFile, config_link, urdf_link) => {
        if (window.robot)
            scene.remove(window.robot);
        const manager = new T.LoadingManager();
        const loader = new URDFLoader(manager);
        loader.load(robotFile, result => {
            window.robot = result;
        });
        manager.onLoad = () => {
            scene.add(window.robot);
            window.robot.rotation.x = -Math.PI / 2;
            if (robotSwitch.value == 'Spot Arm') {
                window.robot.position.y = 0.5;
            }
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
                    let success = window.robot.setJointValue(joint[0], slider[0].value);
                    if (!success) {
                        console.log("Failed to set joint value");
                    }
                }
                jointSliders.push(slider);
            })

            init().then( () => {
                load_config(config_link, urdf_link);
            });
        }
    }

    async function load_config(config_link, urdf_link) {
        let configs = yaml.load(await fetch(config_link).then(response => response.text()));
        let urdf = await fetch(urdf_link).then(response => response.text());

        // vis_env_collision(env_settings);

        // move robot to init config
        let jointArr = Object.entries(window.robot.joints).filter(joint => joint[1]._jointType != "fixed" && joint[1].type != "URDFMimicJoint");
        jointArr.forEach( joint => {
            let i = configs.joint_ordering.indexOf(joint[0]);
            if (i != -1) {
                // joint[1].jointValue[0] =  configs.starting_config[i];
                let slider = jointSliders.find(element => element[0].id.trim() == `${joint[0]}-slider`);
                slider[0].value = configs.starting_config[i];
                slider[1].innerHTML = joint[0] + ": " + String(slider[0].value);
                slider[0].oninput();
            }
        })    

        let relaxedIK = new RelaxedIK(configs, urdf);
        
        window.mouseControl = new MouseControl({
            relaxedIK: relaxedIK,
            jointSliders: jointSliders,
            robot_info: configs,
            target_cursor: target_cursor
        });

        window.vrControl = new VrControl({
            renderer,
            scene,
            camera,
            relaxedIK
        });

        setInterval( function(){ 
            window.mouseControl.step();
        }, 5);

    }

    function vis_env_collision(env_settings) {
        const material = new T.MeshBasicMaterial( { color: 0xff00ff } );
        material.transparent = true;
        material.opacity = 0.6;
        if (window.obstacles) {
            window.obstacles.forEach( (obstacle) => {
                scene.remove(obstacle);
            })
            window.obstacles = [];
        } 
        if (env_settings == undefined) {
            return;
        }
        if (env_settings.spheres) {
            env_settings.spheres.forEach( (sphere) => {
                const geometry = new T.SphereGeometry(sphere.scale, 32, 16);
                const mesh = new T.Mesh( geometry, material );
                let pose_ros = {"posi": new T.Vector3(sphere.translation[0], sphere.translation[1], sphere.translation[2] + 0.9),
                                "ori": new T.Quaternion()};
                let pose_three = changeReferenceFrame(pose_ros, T_THREE_to_ROS);
                mesh.position.copy(pose_three.posi);
                window.obstacles.push(mesh);
                scene.add (mesh);
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
                window.obstacles.push(mesh);
                scene.add (mesh);
            })
        }

    }

    renderer.setAnimationLoop( function () {
        renderer.render( scene, camera );
        if (window.vrControl)
            window.vrControl.update();
    
    } );
    
}

