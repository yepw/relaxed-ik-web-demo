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
        let gravity = { x: 0.0, y: 0.0, z: -9.81 };
        let rapierWorld = new RAPIER.World(gravity);

        // Create the ground
        
        let groundDesc = RAPIER.RigidBodyDesc.newStatic()
                    .setTranslation(0., 0., 0.);
        let groundRigidBody = rapierWorld.createRigidBody(groundDesc);
        
        let currCollisionGroup_membership = 0x0001;
        let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 10.0, 0.1)
                                .setDensity(2.0);
        let groundCollider = rapierWorld.createCollider(groundColliderDesc, groundRigidBody.handle);
        groundCollider.setCollisionGroups( currCollisionGroup_membership << 16 | (0xffff & (0xffff ^ currCollisionGroup_membership)));
        // groundCollider.setCollisionGroups( 0x0001fffe);
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
    
        let three_to_ros = new T.Group();
        three_to_ros.rotation.set(-Math.PI/2, 0., 0.);
        scene.add(three_to_ros);

        window.robot = {};
        window.vrControl = undefined;
        let jointSliders = [];
    
        let sawyerRobotFile; 
        getURDFFromURL("https://raw.githubusercontent.com/yepw/robot_configs/master/sawyer_description/urdf/sawyer_gripper.urdf", (blob) => {
            sawyerRobotFile = URL.createObjectURL(blob);
        });
    
        let ur5RobotFile;
        getURDFFromURL("https://raw.githubusercontent.com/yepw/robot_configs/physics/ur5_description/urdf/ur5_gripper.urdf", (blob) => {
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

        function changeRobotVisibility(parent, hideURDFVisual, hideURDFCollider) {
            parent.children.forEach( (child) => {
                if (child.type === 'URDFCollider') {
                    if (hideURDFCollider === true) {
                        child.visible = false; 
                    } else {
                        child.visible = true; 
                    }
                } else  if (child.type === 'URDFVisual') {
                    if (hideURDFVisual === true) {
                        child.visible = false; 
                    } else {
                        child.visible = true; 
                    }
                } else {
                    changeRobotVisibility(child, hideURDFVisual, hideURDFCollider);
                }
            })
        }

        let loadRobot = (robotFile, robot_info_link, robot_nn_config_link, env_settings_link) => {
            if (window.robot)
                scene.remove(window.robot);
            const manager = new T.LoadingManager();
            const loader = new URDFLoader(manager);
            loader.parseCollision = true;
            loader.parseVisual = true;
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


                let createRobotCollider = (currJoint, parentRigidBody, parentCollider) => {
                    if (currJoint.type == 'URDFJoint' || currJoint.type == 'URDFMimicJoint') {
                        currJoint.children.forEach( (childLink) => {
                            if (childLink.type == 'URDFLink') {
                                let urdfCollider = undefined; 
                                let urdfVisual = undefined; 
                                childLink.children.forEach( (gradChild)=> {
                                    if (gradChild.type == 'URDFCollider') {
                                        if (urdfCollider === undefined) {
                                            urdfCollider = gradChild;
                                        } else {
                                            console.warn("Multiple URDF Collider found!");
                                        }
                                    } else if (gradChild.type == 'URDFVisual') {
                                        if (urdfVisual === undefined) {
                                            urdfVisual = gradChild;
                                        } else {
                                            console.warn("Multiple URDF Visual found!");
                                        }
                                    }
                                });
                               
                                let mass = childLink.mass;
                                if (!mass) {
                                    console.warn("Undefined mass!");
                                    mass = 1.0;
                                }

                                let rigidBodyDesc = RAPIER.RigidBodyDesc.newDynamic().setAdditionalMass(mass);
                                let rigidBody = rapierWorld.createRigidBody(rigidBodyDesc);

                                let collider = undefined;
                                if (urdfCollider !== undefined ) {
                                    let recursivelyFindMesh = function(node) {
                                        if (node.type === 'Mesh') {
                                            return [node];
                                        }
                                        let meshes = []
                                        node.children.forEach( (child) => {
                                            meshes = meshes.concat( recursivelyFindMesh(child));
                                        });
                                        return meshes;
                                    }
                                   
                                    let colliderMeshes = recursivelyFindMesh(urdfCollider);

                                    if (colliderMeshes.length != 1) {
                                        console.warn("No collider mesh or multiple collider meshes were found under: ");
                                        console.log(urdfCollider);
                                        return;
                                    } 

                                    let colliderMesh = colliderMeshes[0];
                                    let vertices = colliderMesh.geometry.getAttribute('position');
                                    let indices = colliderMesh.geometry.index;
                                    if (indices == null) {
                                        // unindexed bufferedgeometry
                                        indices = [...Array(vertices.count).keys()]
                                    }
                                    let colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
                                    collider = rapierWorld.createCollider(colliderDesc, rigidBody.handle);
                                   
                                    if (urdfVisual !== undefined) {
                                        let mesh = urdfVisual.clone();
                                        three_to_ros.add(mesh);
                                        coll2mesh.set(collider, mesh);
                                    }
                                }

                                console.log(currJoint);
                                if ( currJoint._jointType === "fixed") {
                                    console.log("fixed");
                                    if (collider) {
                                        let parentGroups_membership  =  parentCollider.collisionGroups() >> 16;
                                        collider.setCollisionGroups( (parentGroups_membership << 16) | ( 0xffff & (0xffff ^ parentGroups_membership)));
                                    }

                                    const position = currJoint.origPosition;
                                    const quaternion = currJoint.origQuaternion;
                                    // TODO: take care of orientation in URDF
                                    const anchor1 = new RAPIER.Vector3( position.x, position.y, position.z);
                                    const frame1 = new RAPIER.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w);

                                    let params = RAPIER.JointData.fixed(anchor1, frame1, 
                                                    new RAPIER.Vector3( 0.0, 0.0, 0.0), new RAPIER.Quaternion(0.0, 0.0, 0.0, 1.0));
                                    
                                    rapierWorld.createImpulseJoint(params, parentRigidBody, rigidBody);
                                    childLink.children.forEach( (joint) => {
                                        createRobotCollider(joint, rigidBody, parentCollider);
                                    });

                                } else if (currJoint._jointType === "revolute") {
                                    console.log("revolute");
                                    if (collider) {
                                        currCollisionGroup_membership *= 2;
                                        let parentGroups_membership  =  parentCollider.collisionGroups() >> 16;
                                        let parentGroups_filter   =  parentCollider.collisionGroups() & 0xffff;
                                        collider.setCollisionGroups( (currCollisionGroup_membership << 16) | ( 0xffff & (0xffff ^ (parentGroups_membership | currCollisionGroup_membership))));
                                        parentCollider.setCollisionGroups( (parentGroups_membership << 16) | (parentGroups_filter & ( parentGroups_filter ^ currCollisionGroup_membership)));
                                    }

                                    const position = currJoint.origPosition;
                                    const quaternion = currJoint.origQuaternion;
                                    // TODO: take care of orientation in URDF
                                    const anchor1 = new RAPIER.Vector3( position.x, position.y, position.z);
                                    const axis = new RAPIER.Vector3( currJoint.axis.x, currJoint.axis.y, currJoint.axis.z);

                                    const params = RAPIER.JointData.revolute(anchor1, new RAPIER.Vector3( 0.0, 0.0, 0.0), axis);
                                    const rapier_joint = rapierWorld.createImpulseJoint(params, parentRigidBody, rigidBody);
                                    window.robot.name2joint.set(currJoint.name, rapier_joint);
                                    // joint.configureMotorPosition(1.0, 0.5, 0.5);
                                    // rapier_joint.configureMotorVelocity(1.0, 0.5);
                                    console.log(rapier_joint)
                                    console.log(rapier_joint.rawSet.jointConfigureMotorVelocity())
                                    console.log(rapier_joint.rawAxis())
                                    // console.log(Object.getPrototypeOf(rapier_joint))
                                    // console.log(Object.getPrototypeOf(Object.getPrototypeOf(rapier_joint)))
                                    // console.log(Object.getPrototypeOf(Object.getPrototypeOf(rapier_joint)).configureMotorVelocity())

                                    rapier_joint.rawSet.jointConfigureMotorVelocity(rapier_joint.handle, rapier_joint.rawAxis(), 1.0, 0.5)

                                    childLink.children.forEach( (joint) => {
                                        createRobotCollider(joint, rigidBody, collider);
                                    });
                                } else {
                                    console.log(currJoint._jointType);
                                }
                            }
                        })
                    } 
                }
                // changeRobotVisibility(window.robot, true, true);
                window.robot.visible = false;
                window.robot.name2joint = new Map();
                window.robot.children.forEach( (joint) => {
                    createRobotCollider(joint, groundRigidBody, groundCollider);
                });
            }
        }

        async function load_config(robot_info_link, robot_nn_config_link, env_settings_link) {
            let robot_info = yaml.load(await fetch(robot_info_link).then(response => response.text()));
            let robot_nn_config = yaml.load(await fetch(robot_nn_config_link).then(response => response.text()));
            let env_settings = yaml.load(await fetch(env_settings_link).then(response => response.text()));

            // vis_env_collision(env_settings);

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
                    let body = rapierWorld.createRigidBody(bodyDesc);
                    let colliderDesc = RAPIER.ColliderDesc.ball(sphere.scale);
                    let collider = rapierWorld.createCollider(colliderDesc, body.handle);

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
                    let collider = rapierWorld.createCollider(colliderDesc);

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
            rapierWorld.step();
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

