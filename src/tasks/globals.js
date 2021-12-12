import * as T from 'three';

export const EE_TO_GRIPPER_OFFSET = 0.13;

export const EE_TO_THREE_ROT_OFFSET = new T.Quaternion().setFromEuler(new T.Euler(0, -Math.PI/2, -Math.PI/2, 'ZYX'));