import * as T from 'three';
import { create, all } from 'mathjs'

const config = { }
const math = create(all, config);

export function rotQuaternion(q, rot) {
    let axisAngle = quaternionToAxisAngle(q);
    let new_axis = axisAngle.axis.clone().applyMatrix4(rot);
    return new T.Quaternion().setFromAxisAngle(new_axis, axisAngle.angle);        
}

export function changeReferenceFrame(pose, transform) {
    return {
        "posi": pose.posi.clone().applyMatrix4(transform.clone()),
        "ori": rotQuaternion(pose.ori.clone(), transform.clone()) };
}

export function quaternionToAxisAngle(q) {
    // https://www.euclideanspace.com/maths/geometry/rotations/conversions/quaternionToAngle/index.htm
    if (q.w > 1) q.normalize();
    let angle = 2 * Math.acos(q.w);
    let s = Math.sqrt(1-q.w*q.w);
    let x, y, z;
    if (s < 0.001) { // test to avoid divide by zero, s is always positive due to sqrt
        // if s close to zero then direction of axis not important
        x = q.x; // if it is important that axis is normalised then replace with x=1; y=z=0;
        y = q.y;
        z = q.z;
      } else {
        x = q.x / s;  // normalise axis
        y = q.y / s;
        z = q.z / s;
      }
    return {axis: new T.Vector3(x, y, z),
            angle: angle};
}

export function degToRad(degrees) {
    var result = Math.PI / 180 * degrees;
    return result;
}

export function getCurrEEpose() {
    let ee_posi = new T.Vector3();
    window.robot.links.finger_tip.getWorldPosition(ee_posi);
    let ee_ori = new T.Quaternion();
    window.robot.links.finger_tip.getWorldQuaternion(ee_ori);
    return {"posi": ee_posi, 
            "ori": ee_ori}
}

export function mathjsMatToThreejsVector3(a){
    console.assert( a.size()[0] === 3 , "mathjs matrix is not 3x1");
    let res = new T.Vector3(
        a._data[0],
        a._data[1],
        a._data[2]
    )
    return res;
}

export function threejsVector3ToMathjsMat(a){
    let res = new math.matrix([
        [a.x],
        [a.y],
        [a.z]
    ]);
    return res;
}

export function Line3D (points, color, width) {
    let material = new T.MeshBasicMaterial({
        color: color
    })

    let path = new T.CatmullRomCurve3(points, true);
    let radialSegments = 10
    let geometry2 = new T.TubeGeometry(path, points.length, width, radialSegments);

    return new T.Mesh(geometry2, material);
}

export function castShadow(obj) {
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

// https://stackoverflow.com/questions/9847580/how-to-detect-safari-chrome-ie-firefox-and-opera-browser
export function getBrowser() {
    // Opera 8.0+
    var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;

    // Firefox 1.0+
    var isFirefox = typeof InstallTrigger !== 'undefined';

    // Safari 3.0+ "[object HTMLElementConstructor]" 
    var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && window['safari'].pushNotification));

    // Internet Explorer 6-11
    var isIE = /*@cc_on!@*/false || !!document.documentMode;

    // Edge 20+
    var isEdge = !isIE && !!window.StyleMedia;

    // Chrome 1 - 79
    var isChrome = !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime);

    // Edge (based on chromium) detection
    var isEdgeChromium = isChrome && (navigator.userAgent.indexOf("Edg") != -1);

    // Blink engine detection
    var isBlink = (isChrome || isOpera) && !!window.CSS;


    let output = isFirefox ? "Firefox_" : ''
               + isChrome ? "Chrome_" : ''
               + isSafari ? "Safari_" : ''
               + isOpera ? "Opera_" : ''
               + isIE ? "IE_" : ''
               + isEdge ? "Edge_" : ''
               + isEdgeChromium ? "EdgeChromium_" : '';

    return output;
}

// transformation from ROS' reference frame to THREE's reference frame
export let T_ROS_to_THREE = new T.Matrix4().makeRotationFromEuler(new T.Euler(Math.PI/2, 0., 0.));
// transformation from THREE' reference frame to ROS's reference frame
export let T_THREE_to_ROS = T_ROS_to_THREE.clone().invert();

export function relToAbs(rel_pose, init_pose) {
    return {
        "posi": init_pose.posi.clone().add(rel_pose.posi),
        "ori": init_pose.ori.clone().premultiply(rel_pose.ori) };
}

export function absToRel(abs_pose, init_pose) {
    return {
        "posi": abs_pose.posi.clone().add( init_pose.posi.clone().negate()),
        "ori": init_pose.ori.clone().invert().premultiply(abs_pose.ori)};
}