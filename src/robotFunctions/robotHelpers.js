import { lerp } from "../helpers";
import { Color } from "three";
import { getSceneColor } from "../sceneInit";

export function recurseMaterialTraverse(material, func) {
    if (material.length > 1) {
        material.forEach(mat => {
            recurseMaterialTraverse(mat, func);
        })
    } else {
        func(material);
    }
}

export function cloneMaterial (parent) {
    let recurseCloneMaterial = (parent) => {
        // parent has material list
        if(parent.material) {
            let list = [];
            parent.material.forEach(mat => {
                list.push(recurseCloneMaterial(mat));
            })
            parent.material = list;
            return parent.material;
        } 
        // parent is material
        else {
            let matClone = parent.clone();
            return matClone;
        }
    }
    if (parent.material.length > 1) {
        recurseCloneMaterial(parent);
    } else {
        let matClone = parent.material.clone();
        parent.material = matClone;
    }
}

export function getJointList(robot) {
    return Object.entries(robot.joints).filter(joint => joint[1]._jointType != "fixed" && joint[1].type != "URDFMimicJoint");
}

export function getDesaturatedColor(color) {
    const sceneColor = getSceneColor();

    let r = color.r;
    let g = color.g;
    let b = color.b;

    let average = (r + g + b) / 3;

    r = lerp(lerp(r, average, 0.4), sceneColor.r, 0.4);
    g = lerp(lerp(g, average, 0.4), sceneColor.g, 0.4);
    b = lerp(lerp(b, average, 0.4), sceneColor.b, 0.4);

    return new Color(r, g, b);
}