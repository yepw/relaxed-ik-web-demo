import * as T from 'three';
import URDFLoader from 'urdf-loader';
import { FileUploader, Select, Checkbox, Button, Slider, Container, TextInput } from '../ui/pageElements';
import { getURDFFromURL, getURDFFromLocal } from '../robotFunctions/loaderHelper';
import { AnimationInterface } from './animationInterface';
import { LineInterface } from './lineInterface';
import { JointInterface } from './jointInterface';

export class RobotInterface {
    constructor(scene, interfaces) {

        this.manager = new T.LoadingManager();
        this.loader = new URDFLoader(this.manager);

        this.focusSelector;
        this.scene = scene;
        this.interfaces = interfaces;
        this.allRobots = [];
        this.focusJoint;
        this.robotGroup;

        this.interfaces.lines = new LineInterface(this.scene, this.interfaces);
        this.topBlock = new Container("topBlock", "topDiv");
        this.robotSelector = new Select("Robot Selector", "topDiv");
        this.visibilityCheck = new Checkbox("Keep Robots Shown", "topDiv", false);

        this.robotLoader = new FileUploader("Upload Robot", "inputs", [], true);
        this.robotLoader.fileUploader.onchange = () => {
            if (this.robotLoader.getFiles().length > 0) {
                getURDFFromLocal(this.robotLoader.getFiles(), (blob) => {
                    loadRobot(URL.createObjectURL(blob))
                });
            }
        }
        this.urlInput = new TextInput("URDF URL", "inputs");
        this.loadURL = new Button("Load", "inputs", () => {
            getURDFFromURL(this.urlInput.textInput.value, (blob) => {
                loadRobot(URL.createObjectURL(blob))
            });
        })

        let recurseMaterialTraverse = (material, func) => {
            if (material.length > 1) {
                material.forEach(mat => {
                    recurseMaterialTraverse(mat, func);
                })
            } else {
                func(material);
            }
        }

        let loadRobot = (robotFile) => {
            let robot, focusSelector;

            this.loader.load(robotFile, result => {
                robot = result;
            });
            this.manager.onLoad = () => {
                this.scene.add(robot);
                robot.rotation.x = -Math.PI / 2;
                robot.position.y = 1;
                robot.traverse(c => {
                    c.castShadow = true;
                    if (c.material) {
                        recurseMaterialTraverse(c.material, (material) => {
                            material.alphaToCoverage = true;
                        })
                    }
                });

                let focusList = Object.entries(robot.joints).concat(Object.entries(robot.links));
                focusSelector = new Select("End Effector Selector", this.topBlock.div.id, focusList);
                focusSelector.select.onchange = () => {
                    this.focusJoint = focusSelector.getSelected();
                }

                let animationInterface = new AnimationInterface(robot, this.scene, this.interfaces);

                this.allRobots.push({
                    robot: robot,
                    animationInterface: animationInterface,
                    focusSelector: focusSelector,
                    opacity: 1
                });

                if (this.allRobots.length == 1) {
                    this.robotGroup = this.allRobots[0];
                    this.focusJoint = focusList[0][1];
                    this.interfaces.animation = animationInterface;;
                    this.focusSelector = focusSelector;
                    this.interfaces.joints = new JointInterface(this.interfaces);
                    this.interfaces.animation.setFocusJoint(this.focusJoint);
                } else {
                    animationInterface.hideUI();
                    robot.visible = false;
                    focusSelector.removeDiv();
                }

                this.robotSelector.addOption([robot.robotName, robot]);
                this.interfaces.joints.addRobot(robot);
            }
        }

        // opacity of the robot
        this.opacitySlider = new Slider("Robot Opacity", "topDiv", 0, 1, 0.01, 1);
        this.opacitySlider.label.innerHTML = "Robot Opacity: 1";
        this.opacitySlider.slider.oninput = () => {
            this.opacitySlider.label.innerHTML = "Robot Opacity: " + String(this.opacitySlider.slider.value);
            this.robotGroup.robot.traverse(c => {
                if (c.material) {
                    recurseMaterialTraverse(c.material, (material) => {
                        material.opacity = this.opacitySlider.slider.value;
                    })
                }
            })
        }

        this.robotSelector.select.onchange = () => {
            // save
            this.robotGroup.opacity = this.opacitySlider.slider.value;
            this.robotGroup.animationInterface.hideUI()
            this.robotGroup.robot.visible = this.visibilityCheck.checkbox.checked;
            this.focusSelector.removeDiv();

            // update
            this.robotGroup = this.allRobots[this.robotSelector.select.selectedIndex];
            this.robotGroup.robot.visible = true;
            this.interfaces.joints.updateSliders();
            this.interfaces.animation = this.robotGroup.animationInterface;
            this.interfaces.animation.showUI();
            this.focusSelector = this.robotGroup.focusSelector;
            this.focusSelector.addDiv();
            this.opacitySlider.label.innerHTML = "Robot Opacity: " + this.robotGroup.opacity;
            this.opacitySlider.slider.value = this.robotGroup.opacity;
            this.focusJoint = this.focusSelector.getSelected();
        }

        this.topBlock.addBlock(this.robotLoader, this.urlInput, this.loadURL, this.robotSelector, this.visibilityCheck, this.opacitySlider);
    }

    getScene() {
        return this.scene;
    }

    getRobot() {
        return this.robotGroup.robot;
    }

    getInterfaces() {
        return this.interfaces;
    }

    getFocusJoint() {
        return this.focusJoint;
    }

    hoverRobot() {

    }
}