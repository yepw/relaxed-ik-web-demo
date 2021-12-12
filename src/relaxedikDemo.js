import * as T from 'three';
import URDFLoader from 'urdf-loader';
import { initScene } from './sceneInit';
import { getURDFFromURL } from './robotFunctions/loaderHelper';
import { recurseMaterialTraverse } from './robotFunctions/robotHelpers';
import { createSlider, createCanvas, createText, createToggleSwitch, createBr, createSelect } from './ui/inputAdders';

import { MouseControl } from './mouseControl.js';
import { VrControl } from './vrControl.js'

import init, {RelaxedIK} from "../relaxed_ik_web/pkg/relaxed_ik_web.js";
import * as yaml from 'js-yaml';
import { getCurrEEpose } from './utils';
import { ControlMapping} from './controlMapping';
import { create } from 'mathjs';

import { TaskControl } from './taskControl.js'

export function relaxedikDemo() {

    let scene, camera, renderer, camControls, target_cursor;

    // Load robot
    
    // const manager = new T.LoadingManager();
    // const loader = new URDFLoader(manager);

    let init_scene = initScene();
    scene = init_scene[0];
    camera = init_scene[1];
    renderer = init_scene[2];
    camControls = init_scene[3];
    camera.position.set(2, 2, 2);
    camera.lookAt(0, 1, 0);

    window.robot = {};
    let mouseControl = undefined;
    window.vrControl = undefined;
    let jointSliders = [];

    let sawyerRobotFile; 
    getURDFFromURL("https://raw.githubusercontent.com/yepw/robot_configs/master/sawyer_description/urdf/sawyer_gripper.urdf", (blob) => {
        sawyerRobotFile = URL.createObjectURL(blob)
    });

    let ur5RobotFile;
    getURDFFromURL("https://raw.githubusercontent.com/yepw/robot_configs/master/ur5_description/urdf/ur5_gripper.urdf", (blob) => {
        ur5RobotFile = URL.createObjectURL(blob)
    });

    getURDFFromURL("https://raw.githubusercontent.com/gjnguyen18/URDF-Model-Viewer-Test-Files/main/backgrounds/kitchen%20updated/Kitchen/Kitchen_dynamic/urdf/kitchen_dynamic.urdf", (blob) => {
        loadKitchenDynamic(URL.createObjectURL(blob))
    });

    // refridgerator, props (plates, microwave, bowls, etc.)
    getURDFFromURL("https://raw.githubusercontent.com/gjnguyen18/URDF-Model-Viewer-Test-Files/main/backgrounds/kitchen%20updated/Kitchen/Kitchen_standard/urdf/Kitchen_standard.urdf", (blob) => {
        loadKitchenStandard(URL.createObjectURL(blob))
    });

    // kitchen 
    getURDFFromURL("https://raw.githubusercontent.com/gjnguyen18/URDF-Model-Viewer-Test-Files/main/backgrounds/kitchen%20updated/Kitchen/Kitchen_static/urdf/Kitchen_static.urdf", (blob) => {
        loadKitchenStatic(URL.createObjectURL(blob))
    });

    createText("How to control:", "inputs", "h3");

    createText("1. Click the red dot below.", "inputs", "p");
    createText("2. Move your mouse to control the robot.", "inputs", "p");
    createText("3. Scroll mouse wheel to move the robot up and down.", "inputs", "p");
    createText("4. Right-click to switch to rotation mode.", "inputs", "p");
    createText("5. Press the ESC button on your keyboard to unlock your cursor.", "inputs", "p");

    createBr("inputs");
    createBr("inputs");

    createText("Task Options:", "inputs", "h3");
    createSelect("tasks", "Select a task", "inputs", [
        "PickAndPlaceStatic",
        "PickAndPlaceDynamic",
        "PickAndPlaceMoving"
    ])

    createBr("inputs");
    createBr("inputs");

    createText("VR Options:", "inputs", "h3");
    createToggleSwitch ("stereo", "inputs", "Mono", "Stereo", true);
    createToggleSwitch ("parallax", "inputs", "No Parallax", "Parallax", true);

    let robotSwitch = createSelect("robot", "Robot", "inputs", [
        'None',
        'Sawyer',
        'UR5'
    ]);

    robotSwitch.onchange = function() {
        switch (robotSwitch.value) {
            case 'Sawyer':
                loadRobot(sawyerRobotFile,
                    "https://raw.githubusercontent.com/yepw/robot_configs/master/info_files/sawyer_gripper_info.yaml",
                    "https://raw.githubusercontent.com/yepw/robot_configs/master/collision_nn_rust/sawyer_nn.yaml");
                break;
            case 'UR5':
                loadRobot(ur5RobotFile,
                    "https://raw.githubusercontent.com/yepw/robot_configs/master/info_files/ur5_gripper_info.yaml",
                    "https://raw.githubusercontent.com/yepw/robot_configs/master/collision_nn_rust/ur5_nn.yaml");
                break;
            case 'None':
            default:
        }
    }

    createBr("inputs");
    createBr("inputs");

    createText("Options:", "inputs", "h3");
    createToggleSwitch ("cursor-or-robot", "inputs", "Move robot", "Move cursor", true);
    createToggleSwitch ("show-cursor", "inputs", "Hide cursor", "Show cursor", true);

    createCanvas("mouse-control", "bottomDiv");

    let meaningful_axes = [ 'Robot right', 
                            'Robot forward', 
                            'World up', 
                            'Camera up', 
                            'Camera right',
                            'Farther away w.r.t to camera',
                            'Cross product of world up and camera right',
                            'End-effector x-axis',
                            'End-effector y-axis',
                            'End-effector forward',
                            'Camera right projects to ground',
                            'Camera up projects to ground',
                            'Camera right projects to wrist plane',
                            'Camera up projects to wrist plane'];

    let controlMapping = new ControlMapping([]);
     
    let controlMappingSelect = createSelect("control-mappings", "Common control mappings", "inputs", [
        'Robot frame',
        'Camera frame',
        'Camera right + world up',
        'Camera projects to ground plane',
        'Camera projects to wrist plane',
        'Custom combinations'
    ]);

    let mouseRightSelect = createSelect("mouse-right", "Mouse right maps to", "inputs", meaningful_axes);
    mouseRightSelect.onchange = function(user_change) {
        controlMapping.directions[0] = mouseRightSelect.value;
        if (user_change)
            controlMappingSelect.value = "Custom combinations";
    }
    let mouseForwardSelect = createSelect("mouse-forward", "Mouse forward maps to", "inputs", meaningful_axes);
    mouseForwardSelect.onchange = function(user_change) {
        controlMapping.directions[1] = mouseForwardSelect.value;
        if (user_change)
            controlMappingSelect.value = "Custom combinations";
    }
    let mouseWheelSelect = createSelect("mouse-wheel", "Mouse wheel maps to", "inputs", meaningful_axes);
    mouseWheelSelect.onchange = function(user_change) {
        controlMapping.directions[2] = mouseWheelSelect.value;
        if (user_change)
            controlMappingSelect.value = "Custom combinations";
    }

    controlMappingSelect.onchange = function() {
        switch (controlMappingSelect.value) {
            case 'Custom combinations':
                break;
            case 'Camera frame':
                mouseRightSelect.value = "Camera right";
                mouseRightSelect.onchange(false);
                mouseForwardSelect.value = "Camera up";
                mouseForwardSelect.onchange(false);
                mouseWheelSelect.value = "Farther away w.r.t to camera";
                mouseWheelSelect.onchange(false);
                break;
            case 'Camera right + world up':
                mouseRightSelect.value = "Camera right";
                mouseRightSelect.onchange(false);
                mouseForwardSelect.value = "World up";
                mouseForwardSelect.onchange(false);
                mouseWheelSelect.value = "Cross product of world up and camera right";
                mouseWheelSelect.onchange(false);
                break;
            case 'Camera projects to ground plane':
                mouseRightSelect.value = "Camera right projects to ground";
                mouseRightSelect.onchange(false);
                mouseForwardSelect.value = "Camera up projects to ground";
                mouseForwardSelect.onchange(false);
                mouseWheelSelect.value = "World up";
                mouseWheelSelect.onchange(false);
                break;
            case 'Camera projects to wrist plane':
                mouseRightSelect.value = "Camera right projects to wrist plane";
                mouseRightSelect.onchange(false);
                mouseForwardSelect.value = "Camera up projects to wrist plane";
                mouseForwardSelect.onchange(false);
                mouseWheelSelect.value = "End-effector forward";
                mouseWheelSelect.onchange(false);
                break;
            case 'Robot frame':
            default:
                mouseRightSelect.value = "Robot right";
                mouseRightSelect.onchange();
                mouseForwardSelect.value = "Robot forward";
                mouseForwardSelect.onchange();
                mouseWheelSelect.value = "World up";
                mouseWheelSelect.onchange();
        }
    }

    controlMappingSelect.value = "Robot frame";
    controlMappingSelect.onchange();

    // transformation from ROS' reference frame to THREE's reference frame
    let T_ROS_to_THREE = new T.Matrix4().makeRotationFromEuler(new T.Euler(1.57079632679, 0., 0.));
    // transformation from THREE' reference frame to ROS's reference frame
    let T_THREE_to_ROS= T_ROS_to_THREE.clone().invert();

    function onCamMove() {
        let m4 = T_ROS_to_THREE.clone().multiply( camera.matrixWorld.clone());
        let m3 = new T.Matrix3().setFromMatrix4(m4);
        controlMapping.updateCamPose(m3);
    }

    camControls.addEventListener('change',onCamMove);

    onCamMove();

    let geometry = new T.SphereGeometry( 0.015, 32, 32 );
    let material = new T.MeshBasicMaterial( {color: 0xffff00} );
    target_cursor = new T.Mesh( geometry, material );
    scene.add( target_cursor );

    let loadRobot = (robotFile, robot_info_link, robot_nn_config_link) => {
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
            // window.robot.position.y = .05;
            // window.robot.position.x = .1;
            // window.robot.scale.x = 1.15;
            // window.robot.scale.y = 1.15;
            // window.robot.scale.z = 1.15;
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

            init().then( () => {
                load_config(robot_info_link, robot_nn_config_link);
            });
        }
    }

    let kitchenTransformation = (kitchen) => {
        kitchen.rotation.x = -Math.PI / 2;
        kitchen.rotation.z = Math.PI;
        kitchen.position.x = -0.5
        kitchen.position.z = -0.7
    }

    let loadKitchenStatic = (kitchenFile) => {
        const manager = new T.LoadingManager();
        const loader = new URDFLoader(manager);
        loader.load(kitchenFile, result => {
            window.kitchenStatic = result;
        });
        manager.onLoad = () => {
            kitchenTransformation(window.kitchenStatic);
            window.kitchenStatic.scale.x = 0.87;
            window.kitchenStatic.scale.y = 0.87;
            window.kitchenStatic.scale.z = 0.87;
        }
    }

    let loadKitchenStandard = (kitchenFile) => {
        const manager = new T.LoadingManager();
        const loader = new URDFLoader(manager);
        loader.load(kitchenFile, result => {
            window.kitchenStandard = result;
        });
        manager.onLoad = () => {
            kitchenTransformation(window.kitchenStandard);
            window.kitchenStandard.position.y = 0.8
            window.kitchenStandard.scale.x = 0.87;
            window.kitchenStandard.scale.y = 0.87;
            window.kitchenStandard.scale.z = 0.87;
        }
    }

    let loadKitchenDynamic = (kitchenFile) => {
        const manager = new T.LoadingManager();
        const loader = new URDFLoader(manager);
        loader.load(kitchenFile, result => {
            window.kitchenDynamic = result;
        });
        manager.onLoad = () => {
            kitchenTransformation(window.kitchenDynamic);
            window.kitchenDynamic.scale.x = 0.87;
            window.kitchenDynamic.scale.y = 0.87;
            window.kitchenDynamic.scale.z = 0.87;
        }
    }

    window.taskControl  = new TaskControl({ scene, camera });
    let taskSelect = createSelect("tasks", "tasks", "inputs", [
        'None',
        'Pick and Place',
        'Drawing'
    ]);
    taskSelect.onchange = function() {
        switch (taskSelect.value) {
            case 'Drawing':
                window.taskControl.curr_task = 'drawing';
                taskControl.init();
                break;
            case 'Pick and Place':
                window.taskControl.curr_task = 'pickplace';
                taskControl.init();
            case 'None':
            default:
        }
    }

    async function load_config(robot_info_link, robot_nn_config_link) {
        let robot_info = yaml.load(await fetch(robot_info_link).then(response => response.text()));
        let robot_nn_config = yaml.load(await fetch(robot_nn_config_link).then(response => response.text()));

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

        let relaxedIK = new RelaxedIK(robot_info, robot_nn_config);
        
        mouseControl = new MouseControl({
            relaxedIK: relaxedIK,
            jointSliders: jointSliders,
            robot_info: robot_info,
            target_cursor: target_cursor,
            controlMapping: controlMapping
        });

        setInterval( function(){ 
            const curr_ee_abs_three = getCurrEEpose();
            if (mouseControl.step()) {
                let m4 = T_ROS_to_THREE.clone().multiply( new T.Matrix4().makeRotationFromQuaternion(curr_ee_abs_three.ori));
                let m3 = new T.Matrix3().setFromMatrix4(m4);
                controlMapping.updateEEPose(m3);
            } 
            taskControl.update(curr_ee_abs_three)
        }, 5);

        window.vrControl = new VrControl({
            renderer,
            scene,
            camera,
            relaxedIK,
            mouseControl,
            controlMapping
        });
    }

    // function render() {
    //     renderer.render(scene, camera);

    //     requestAnimationFrame(render);
    // }


    // render();

    renderer.setAnimationLoop( function () {

        renderer.render( scene, camera );
        if (window.vrControl)
            window.vrControl.update();
    
    } );
    
}

