/**
 * @author Yeping Wang
 */

import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import Task from './Task'

const BOARD_ANGLE = Math.PI/4;
const SNAPPING_THOLD = 0.05;

function boardTransform(point, invert = false) {
    // if invert == true, point is in the world frame
    // if invert == false, point is in the board frame

    //  the transformation from world to board
    let transform = new T.Matrix4().compose(
        new T.Vector3(0.65, 1, 0),
        new T.Quaternion().setFromEuler(
            new T.Euler(-Math.PI/2, -BOARD_ANGLE, -Math.PI/2)),
        new T.Vector3(1, 1, 1));
    if (invert)
        return point.applyMatrix4(transform.invert())
    else
        return point.applyMatrix4(transform)
}

export class circleCurve extends T.Line {
    constructor () {
        let material = new T.LineBasicMaterial({
            color: 0x0000aa,
            side: T.DoubleSide,
            linewidth: 4
        });

        let circleGeometry = new T.CircleGeometry( 0.3, 64 );
        let circle_points = Array.from(circleGeometry.getAttribute('position').array);
        circle_points.shift();
        circle_points.shift();
        circle_points.shift();

        let points = [];
        for (let i=0; i<circle_points.length / (2 * 3); i++) {
            let point = new T.Vector3( circle_points[i*3], circle_points[i*3+1], circle_points[i*3+2]);
            point.x += 0.12;
            point.y -= 0.12;
            points.push( boardTransform(point) );
        }

        const geometry = new T.BufferGeometry().setFromPoints(points);
		super(geometry, material);
    }
}

export class rectCurve extends T.Line{
    constructor () {
        let material = new T.LineBasicMaterial({
            color: 0x0000aa,
            side: T.DoubleSide,
            linewidth: 4
        });

        let rect_points = [
            new T.Vector3(-0.18, -0.1, 0),
            new T.Vector3(-0.18, 0.15, 0),
            new T.Vector3(0.32, 0.15, 0),
            new T.Vector3(0.32, -0.1, 0)
        ]

        let points = [];
        for (let i=0; i<rect_points.length; i++) {
            let point = rect_points[i].clone();
            points.push( boardTransform(point) );
        }

        const geometry = new T.BufferGeometry().setFromPoints(points);
        super(geometry, material);
    }
}

export class SVGCurve extends T.Group{
    constructor (file_name) {
        super();
        let factor = 0.0006;
        let that = this;
        const loader = new SVGLoader();
        this.labcurve = new T.Group();
        // load a SVG resource
        loader.load(
            // resource URL
            '../images/' + file_name,
            // called when the resource is loaded
            function (data) {
                const paths = data.paths;
                const material = new T.LineBasicMaterial({
                    color: 0x0000aa,
                    side: T.DoubleSide,
                    linewidth: 4
                });

                for (let i = 0; i < paths.length; i++) {
                    const path = paths[i];

                    let curves = path.subPaths[0].curves;
                    for (let j = 0; j < curves.length; j++) {
                        let curve = resizeBezierCurve(curves[j], factor);
                        let points2d = curve.getPoints(20);
                        // console.log("points2d ", points2d);
                        let points = [];
                        for (let i=0; i<points2d.length; i++) {
                            let point = new T.Vector3( points2d[i].x - 0.18 - 49.42 * factor,
                                                            - points2d[i].y - 0.1 + 543.29 * factor,
                                                            0);
                            points.push( boardTransform(point) );
                        }

                        let geometry = new T.BufferGeometry().setFromPoints(points);
                        let mesh = new T.Line(geometry, material);
                        that.add(mesh);
                    }
                }
            },
            // called when loading is in progresses
            function (xhr) {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            // called when loading has errors
            function (error) {
                console.log('An error happened', error);
            }
        );
    }
}

function resizeBezierCurve(orig_curve, factor) {
    let new_curve = new T.CubicBezierCurve(
        orig_curve.v0.divideScalar(1 / factor),
        orig_curve.v1.divideScalar(1 / factor),
        orig_curve.v2.divideScalar(1 / factor),
        orig_curve.v3.divideScalar(1 / factor)
    );
    return new_curve;
}

class eeCurve {
    constructor(options) {
        // https://stackoverflow.com/questions/31399856/drawing-a-line-with-three-js-dynamically/31411794#31411794
        options = options || {};
        options.maxPoints = options.maxPoints || 5000;
        options.color = options.color || 0xff0000;
        options.lineWidth = options.lineWidth || 2;

        this.scene = options.scene;

        this.maxPoints = options.maxPoints;
        let geometry = new T.BufferGeometry();
        this.pointsNum = 0;
        // 3D points are for visualization
        this.pointsPositions = new Float32Array(options.maxPoints * 3);
        // 2D points are for data storage
        this.points2DPositions = new Float32Array(options.maxPoints * 2);

        geometry.setAttribute('position', new T.BufferAttribute(this.pointsPositions, 3));
        // material
        let material = new T.LineBasicMaterial({
            color: options.color,
            linewidth: options.lineWidth
        });
        // line
        this.line = new T.Line(geometry, material);
    }

    add2DPoint(x, y) {
        if (this.pointsNum !== -1  && this.pointsNum < this.maxPoints) {
            this.points2DPositions[this.pointsNum * 2 + 0] = x;
            this.points2DPositions[this.pointsNum * 2 + 1] = y;
        }
    }

    addPoint(x, y, z) {
        // https://stackoverflow.com/questions/31399856/drawing-a-line-with-three-js-dynamically/31411794#31411794
        if (this.pointsNum !== -1 && this.pointsNum < this.maxPoints) {
            this.pointsPositions[this.pointsNum * 3 + 0] = x;
            this.pointsPositions[this.pointsNum * 3 + 1] = y;
            this.pointsPositions[this.pointsNum * 3 + 2] = z;
            this.line.geometry.setDrawRange(0, this.pointsNum - 1);
            this.pointsNum++;
            this.line.geometry.attributes.position.needsUpdate = true;
        }
    }

    add() {
        this.scene.add(this.line);
    }

    twoLineIntersect(a1, a2, b1, b2) {
        //https://stackoverflow.com/questions/15690103/intersection-between-two-lines-in-coordinates/15692290#15692290
        let d = (a2.x - a1.x)*(b2.y - b1.y) - (a2.y - a1.y)*(b2.x - b1.x);
        if (Math.abs(d) < 1e-6)
            return false;
        let u = ((b1.x - a1.x)*(b2.y - b1.y) - (b1.y - a1.y)*(b2.x - b1.x))/d;
        let v = ((b1.x - a1.x)*(a2.y - a1.y) - (b1.y - a1.y)*(a2.x - a1.x))/d;
        if (u < 0.0 || u > 1.0)
            return false; // intersection point not between a1 and a2
        if (v < 0.0 || v > 1.0)
            return false; // intersection point not between b1 and b2
        return true;

        // let intersection = {};
        // intersection.x = a1.x + u * (a2.x - a1.x);
        // intersection.y = a1.y + u * (a2.y - a1.y);
        // return intersection;
    }

    initRotCounter(cx, cy) {
        this.a1 = {x:cx, y:cy};
        this.rayCounter = [];
        this.angle = Math.PI/10;
        for (let i=Math.PI * 2 / this.angle - 1; i>=0; i--)
            this.rayCounter[i] = 0;
    }

    // for stirring task
    countNumRot() {
        let a2 = {};
        let b1 = {};
        let b2 = {};
        let length = 10;

        for (let i=0; i<Math.PI*2 / this.angle; i ++) {
            a2.x = this.a1.x + Math.cos(i * this.angle) * length;
            a2.y = this.a1.y + Math.sin(i * this.angle) * length;
            b1.x = this.pointsPositions[(this.pointsNum - 2) * 3 + 0];
            b1.y = this.pointsPositions[(this.pointsNum - 2) * 3 + 1];
            b2.x = this.pointsPositions[(this.pointsNum - 1) * 3 + 0];
            b2.y = this.pointsPositions[(this.pointsNum - 1) * 3 + 1];
            if (this.twoLineIntersect(this.a1, a2, b1, b2)){
                this.rayCounter[i] ++;
                break;
            }
        }
        return Math.min(...this.rayCounter)
    }

    reset() {
        this.pointsNum = 0;
        this.line.geometry.setDrawRange(0, this.pointsNum);
        // set as -1 to show there is no curve. For addPenCurvePoint()
        this.pointsNum = -1;
    }

    remove() {
        this.scene.remove(this.line);
        this.reset();
    }
}

function castShadow(obj) {
    obj.children.forEach(function (child) {
        if (child.constructor.name === 'Mesh') {
            child.castShadow = true;
            child.receiveShadow = true;
        } else if (child.constructor.name === 'Object3D') {
            castShadow(child)
        } else {
            //  console.log('unknown dae format');
        }
    });
}

export class DrawingTask extends Task{
    constructor(options) {
        super();
        this.scene = options.scene;
        this.done = false;
        this.penCurves = [];
        this.currPenCurve = undefined;
    }

    loadModels() {
        this.drawBoard();
        this.drawPen();
        this.drawPenCurve();
    }

    drawPenCurve() {
        let penCurve = new eeCurve({
            "scene": this.scene
        })
        this.penCurves.push ( penCurve );
        penCurve.add();
        return penCurve;
    }

    removePenCurves() {
        for (let i =0; i<this.penCurves.length; i++) {
            this.penCurves[i].remove();
        }
        this.penCurves = [];
    }

    removeModels() {
        this.removeBoard();
        this.removePenCurves();
        this.removePen();
    }

    nextRound() {
        this.removePenCurves();
        if (this.targetCurve)
            this.scene.add(this.targetCurve);
    }

    init() {
        this.loadModels();
    }

    quit() {
        this.reset();
        this.removeModels();
    }

    reset() {
        this.removeTargetCurve();
    }

    drawBoard() {
        let that = this;
        if (!this.board) {
            let loader = new GLTFLoader();
            loader.load(
                '../models/whiteboard/scene.gltf',
                function (gltf) {
                    that.board = gltf.scene;
                    let scale = 0.12;
                    that.board.scale.set(scale, scale, scale);
                    that.board.position.x = 0.65;
                    that.board.position.y = -0.1;
                    that.board.position.z = -0.1;

                    that.board.children[0].children[0].children[0]
                        .children[0].children[0].children[0].scale.set(1, 0.79, 1);
                    that.board.children[0].children[0].children[0]
                        .children[0].children[0].children[0].position.set(0, 0.5, 0);

                    that.board.children[0].children[0].children[0]
                        .children[0].children[0].children[1].rotateZ(-BOARD_ANGLE);
                    that.board.children[0].children[0].children[0]
                        .children[0].children[0].children[1].position.set(-8, 1, 0);
                    that.board.children[0].children[0].children[0]
                        .children[0].children[0].children[1].children[2].material =
                            new T.MeshStandardMaterial({ color: 0xffffff } );

                    castShadow(that.board);
                    that.board.children[0].castShadow = true;
                    that.board.children[0].receiveShadow = true;
                    that.scene.add(that.board);
                },
                function (xhr) {
                    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                },
                function (error) {
                    console.log('An error happened when loading gltf: ' + error);
                }
            );
        } else {
            that.scene.add(that.board);
        }
    }

    removeBoard() {
        if (this.board)
            this.scene.remove(this.board);
    }

    removeTargetCurve() {
        if (this.targetCurve)
            this.scene.remove(this.targetCurve);
    }

    drawPen() {
        let that = this;
        if (!this.pen) {
            let loader = new GLTFLoader();
            loader.load(
                '../models/marker/scene.gltf',
                function (gltf) {
                    that.pen = gltf.scene.children[0].children[0].children[0].children[0].children[0].clone();
                    let scale = 0.011;
                    that.pen.scale.set(scale, scale, scale);
                    that.pen.rotateX( Math.PI / 2); // up
                    that.pen.position.set(0.0, 0.0, -0.085);
                    castShadow(that.pen);
                    window.robot.links.finger_tip.add(that.pen);
                },
                function (xhr) {
                    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                },
                function (error) {
                    console.log('An error happened when loading gltf: ' + error);
                }
            );
        } else {
            window.robot.links.finger_tip.add(that.pen);
        }

        // close the gripper & change finger_tip position
        let robot = document.getElementById('robot-select').value;
        switch (robot) {
            case 'Sawyer':
                window.robot.setJointValue('right_gripper_l_finger_joint',  0);
                break;
            case 'UR5':
                window.robot.setJointValue('finger_joint',  0.60);
                window.mouseControl.updateFingerTip(0, 0.0277, 0);
                break;
            default:
        }
    }

    removePen() {
        if (this.pen)
            window.robot.links.finger_tip.remove(this.pen);
        
        // open the gripper & change finger_tip position
        let robot = document.getElementById('robot-select').value;
        switch (robot) {
            case 'Sawyer':
                window.robot.setJointValue('right_gripper_l_finger_joint',  0.1);
                break;
            case 'UR5':
                window.robot.setJointValue('finger_joint',  0.0);
                window.mouseControl.updateFingerTip(0, -0.0277, 0);
                break;
            default:
        }
    }

    snapping(ee_goal_abs_three) {
        let tmp = boardTransform( ee_goal_abs_three.posi.clone(), true);
        if ( Math.abs(tmp.z) < SNAPPING_THOLD )
            tmp.z = 0;
        ee_goal_abs_three.posi = boardTransform(tmp, false);
    }

    update(ee_pose) {
        let ee_posi = ee_pose.posi;
        // position in board coordinate
        let ee_posi_board =  boardTransform( ee_posi, true);

        // pen_tip close enough to the board
        if (ee_posi_board.z > -0.01 && ee_posi_board.z < 0.01) {
            if (!this.currPenCurve)
                this.currPenCurve = this.drawPenCurve();

            // project
            ee_posi_board.z = 0;

            // transform it back to world coordinate
            let ee_posi_world =  boardTransform (ee_posi_board );

            this.currPenCurve.add2DPoint(ee_posi_board.x, ee_posi_board.y);
            this.currPenCurve.addPoint(
                ee_posi_world.x, ee_posi_world.y, ee_posi_world.z)
        } else {
            if (this.currPenCurve)
                this.currPenCurve = undefined;
        }

    }
}