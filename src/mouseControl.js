/**
 * @author Yeping Wang 
 */

import * as T from 'three';
import { degToRad, getCurrEEpose, rotQuaternion, 
    T_ROS_to_THREE, T_THREE_to_ROS, relToAbs, absToRel,
    changeReferenceFrame, quaternionToAxisAngle } from './utils';

export class MouseControl {
    constructor(options) {
        let that = this;
        options = options || {};

        this.relaxedIK= options.relaxedIK;
        this.jointSliders = options.jointSliders;
        this.robotInfo = options.robot_info;
        this.target_cursor = options.target_cursor;
        
        this.moveTransScale = 1e-4;;
        this.moveRotScale = 3e-4;
        this.wheelTransScale = 3e-2;
        this.wheelRotScale = 3e-2;
       
        this.radius = 35;

        this.init_ee_abs_three = getCurrEEpose();

        this.ee_goal_rel_ros = {"posi": new T.Vector3(),
                                "ori": new T.Quaternion().identity()};

        this.pointer_locked = false;
        this.isRotate = false;

        this.canvas = document.getElementById('mouse-control-canvas');

        this.resizeCanvas();
        this.resizeCanvas = this.resizeCanvas.bind(this);
        window.addEventListener('resize', this.resizeCanvas);

        // pointer lock object forking for cross browser
        this.canvas.requestPointerLock = this.canvas.requestPointerLock ||
            this.canvas.mozRequestPointerLock;

        document.exitPointerLock = document.exitPointerLock ||
            document.mozExitPointerLock;
        
        this.canvas.onclick = function () {
            that.canvas.requestPointerLock();
        };

        this.showCursor = document.getElementById('show-cursor-toggle');
        this.showCursor.onclick = function () {
            if (this.checked) 
                that.target_cursor.visible  = true;
            else
                that.target_cursor.visible  = false;
        }; 

        this.reset = this.reset.bind(this)

        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseWheel = this.onMouseWheel.bind(this);
        this.lockChangeAlert = this.lockChangeAlert.bind(this);
        document.addEventListener('pointerlockchange', this.lockChangeAlert.bind(this), false);
        document.addEventListener('mozpointerlockchange', this.lockChangeAlert.bind(this), false);

        // to assess performance
        this.updateRates = [];
        this.relaxedIKRates = [];
        this.preStepTime = undefined;
    }

    resizeCanvas() {
        let context = this.canvas.getContext('2d');

        let windowSize = {"height" : window.innerHeight,
            "width" : window.innerWidth};
        let height = windowSize.height * 0.25;

        this.viewScale = height / 400;
        context.canvas.height = height
        context.canvas.width = height;
        this.canvasDraw();
    }

    draw_pointer() {
        let context = this.canvas.getContext('2d');
        context.rotate(-20/180*Math.PI);
        context.beginPath();
        context.moveTo(0, 1);
        context.lineTo(-5, 16);
        context.lineTo(-1.3, 15);
        context.lineTo(-1.3, 22);
        context.lineTo(1.3, 22);
        context.lineTo(1.3, 15);
        context.lineTo(5, 16);
        context.closePath();
        context.strokeStyle = "black";
        context.lineWidth = 1.5;
        context.stroke();
        context.fillStyle = "white";
        context.fill();
    }

    canvasDraw() {
        let context = this.canvas.getContext('2d');
        context.save();
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        context.beginPath();
        context.arc(this.canvas.width / 2, this.canvas.height / 2, 
                        this.radius * 5 * this.viewScale, 0, degToRad(360), true);
        context.strokeStyle = "#ffffff";
        context.lineWidth = Math.floor(4 * this.viewScale);
        context.stroke();

        if (this.pointer_locked) {
            if (this.isRotate) {
                context.fillStyle = "#c5c50c";
            } else {
                context.fillStyle = "#05c50c";
            }
        } else {
                context.fillStyle = "#c5050c";
        }
        context.beginPath();
        context.arc(this.canvas.width / 2, this.canvas.height / 2, 
                    this.radius * this.viewScale, 0, degToRad(360), true);
        context.fill();
        context.restore();
        
        if (this.pointer_locked) {
            // draw pointer
            context.save();
            context.translate(this.canvas.width / 2, this.canvas.height / 2);
            this.draw_pointer();
            context.restore();

            // write unlock instructor
            context.save();
            context.fillStyle = "#ffffff";
            context.font = "20px ";
            context.textAlign = "center";
            context.fillText("Press ESC to", this.canvas.width/2, 7 * this.canvas.height/10);
            context.fillText("unlock pointer", this.canvas.width/2, 7 * this.canvas.height/10 + 20);
            context.restore();
            
            // write translate or rotate
            if (this.isRotate) {
                context.save();
                context.fillStyle = "#ffffff";
                context.font = "30px ";
                context.textAlign = "center";
                context.fillText("Rotate", this.canvas.width/2, 2 * this.canvas.height/10);
                context.restore();
            } else {
                context.save();
                context.fillStyle = "#ffffff";
                context.font = "30px ";
                context.textAlign = "center";
                context.fillText("Move", this.canvas.width/2, 2 * this.canvas.height/10);
                context.restore();
            }
        }

    }

    lockChangeAlert() {
        if (document.pointerLockElement === this.canvas ||
            document.mozPointerLockElement === this.canvas) {
            // console.log('The pointer is now LOCKED in Mouse Movement control panel');
            if (!this.pointer_locked) {
                this.pointer_locked = true;
                
                this.canvas.addEventListener("mousemove", this.onMouseMove, false);
                this.canvas.addEventListener("mousedown", this.onMouseDown, false);
                this.canvas.addEventListener('wheel', this.onMouseWheel, false);
            }
        } else {
            // console.log('The pointer is now UNLOCKED in Mouse Movement control panel'); 
            if (this.pointer_locked) {
                this.pointer_locked = false;
                this.canvas.removeEventListener("mousemove", this.onMouseMove, false);
                this.canvas.removeEventListener("mousedown", this.onMouseDown, false);
                this.canvas.removeEventListener('wheel', this.onMouseWheel, false);

                this.reset()
            }
        }
        this.canvasDraw();
    }

    reset() {
        this.relaxedIK.reset([]);
        this.ee_goal_rel_ros = {"posi": new T.Vector3(),
                                "ori": new T.Quaternion().identity()};
    }

    onMouseDown(event) {
        if (!this.pointer_locked) return;
        switch (event.which) {
            case 1: return this.onLeftClick(event);
            case 3: return this.onRightClick(event);
        }
    }

    onLeftClick(event) {
        this.canvasDraw();
    }

    onRightClick(event) {
        this.isRotate = !this.isRotate;
        this.canvasDraw();
    }

    onMouseWheel(event) {
        event.preventDefault();
        if (!this.pointer_locked) return;
        
        let wheelInput;
        // wheelDelta --> Chrome, detail --> Firefox
        if (typeof (event.deltaY) !== 'undefined') {
            wheelInput = event.deltaY;
        } else {
            wheelInput = -event.detail;
        }

        if (this.isRotate) {
            this.ee_goal_rel_ros.ori.premultiply( new T.Quaternion().setFromEuler( new T.Euler(
                0.0,
                0.0,
                Math.sign(wheelInput) * this.wheelRotScale
            )))
        } else {
            let step = new T.Vector3( 
                    0.0,
                    0.0,
                    Math.sign(wheelInput) * this.wheelTransScale);
            this.ee_goal_rel_ros.posi.add( step );
        }
    }

    onMouseMove(e) {
        if (!this.pointer_locked) return;
        let x = e.movementX;
        let y = e.movementY;
        
        if (this.isRotate) {
            this.ee_goal_rel_ros.ori.premultiply( new T.Quaternion().setFromEuler( new T.Euler(
                -y * this.moveRotScale,
                -x * this.moveRotScale,
                0.
            )))
        } else {
            // moving the robot
            let step = new T.Vector3( 
                            -y * this.moveTransScale,
                            -x * this.moveTransScale, 
                            0 );
            this.ee_goal_rel_ros.posi.add( step );
        }
    }

    onControllerMove(x, y, z, r) {
        let step = new T.Vector3( 
                            y,
                            x, 
                            z );

        let r_ros = changeReferenceFrame({"posi": new T.Vector3(), "ori": r.clone()}, T_ROS_to_THREE).ori;

        this.ee_goal_rel_ros.ori.premultiply(r_ros);
      
        this.ee_goal_rel_ros.posi.add( step );
    }
   
    step() {
        let currStepTime = performance.now();
        if (this.preStepTime !== undefined) {
            this.updateRates.push( 1000.0 / (currStepTime - this.preStepTime))
            if (this.updateRates.length > 200) {
                this.updateRates.shift();
            }
        }
        this.preStepTime = currStepTime;

        let ee_goal_rel_ros = {"posi": this.ee_goal_rel_ros.posi.clone(),
                                "ori": this.ee_goal_rel_ros.ori.clone()};
        
        // convert ee_goal from ROS reference frame to THREE reference frame
        let ee_goal_rel_three = changeReferenceFrame(ee_goal_rel_ros, T_THREE_to_ROS);
        let ee_goal_abs_three = relToAbs(ee_goal_rel_three,  this.init_ee_abs_three);

        this.target_cursor.position.copy( ee_goal_abs_three.posi );
        this.target_cursor.quaternion.copy( ee_goal_abs_three.ori );
        this.target_cursor.matrixWorldNeedsUpdate = true;

        let curr_ee_abs_three  = getCurrEEpose();
        // distance difference
        let d = curr_ee_abs_three.posi.distanceTo( ee_goal_abs_three.posi  );
        // angle difference
        let a = curr_ee_abs_three.ori.angleTo( ee_goal_abs_three.ori );

        if ( d > 1e-3 || a > 1e-3 ) {
            let before = performance.now();
            let res;
            res = this.relaxedIK.solve ([
                    ee_goal_rel_ros.posi.x,
                    ee_goal_rel_ros.posi.y,
                    ee_goal_rel_ros.posi.z],
                    [ee_goal_rel_ros.ori.w, ee_goal_rel_ros.ori.x, ee_goal_rel_ros.ori.y, ee_goal_rel_ros.ori.z] );
            let after = performance.now();
            this.relaxedIKRates.push( 1000.0 / (after - before))
            if (this.relaxedIKRates.length === 200) {
                // https://stackoverflow.com/questions/7343890/standard-deviation-javascript
                let n = this.updateRates.length;
                let mean = this.updateRates.reduce((a, b) => a + b) / n;
                let std = Math.sqrt(this.updateRates.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
                let max = Math.max(...this.updateRates);
                let min = Math.min(...this.updateRates);
                // console.log("Avg. update rate in the past 200 loops: M = " + mean.toFixed(3) + "Hz (SD = " + std.toFixed(3) + ") \n Max: " 
                //     + max.toFixed(3) + "Hz  Min: " + min.toFixed(3) + "Hz");

                n = this.relaxedIKRates.length;
                mean = this.relaxedIKRates.reduce((a, b) => a + b) / n;
                std = Math.sqrt(this.relaxedIKRates.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
                max = Math.max(...this.relaxedIKRates);
                min = Math.min(...this.relaxedIKRates);
                // console.log("Avg. RelaxedIK rate in the past 200 loops: M = " + mean.toFixed(3) + "Hz (SD = " + std.toFixed(3) + ") \n Max: " 
                // + max.toFixed(3) + "Hz  Min: " + min.toFixed(3) + "Hz");

                this.updateRates = [];
                this.relaxedIKRates = [];
            }

            let jointArr = Object.entries(window.robot.joints).filter(joint => joint[1]._jointType != "fixed" && joint[1].type != "URDFMimicJoint");
            jointArr.forEach( joint => {
                let i = this.robotInfo.joint_ordering.indexOf(joint[0]);
                if (i != -1) {
                    window.robot.setJointValue(joint[0],  res[i]);
                }
            })   
            jointArr.forEach( joint => {
                let i = this.robotInfo.joint_ordering.indexOf(joint[0]);
                if (i != -1) {
                    joint[1].jointValue[0] = res[i];
                    let slider = this.jointSliders.find(element => element[0].id.trim() == `${joint[0]}-slider`);
                    slider[0].value = joint[1].jointValue[0];
                    slider[1].innerHTML = joint[0] + ": " + String(slider[0].value);
                }
            })    
            return true;
        }
        return false;
    };
};
