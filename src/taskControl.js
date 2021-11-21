import { Brick, PickAndPlaceBricksTabletop } from "./tasks/pickAndPlace"
import * as T from 'three'

import {
    getBrowser, threejsVector3ToMathjsMat,
} from "./utils.js";

export class TaskControl {
    constructor(options) {
        this.scene = options.scene
        this.browser = getBrowser();
        this.study = new PickAndPlaceBricksTabletop({ scene: this.scene });
        this.camera = options.camera;

        const TABLE_HEIGHT = 0.92;

        // 2D array to support multiple bricks/targets in a round
        this.rounds = [
            [
                new Brick({
                    init_posi: new T.Vector3(0.8, TABLE_HEIGHT + 0.02, 0.2),
                    init_angle: 0,
                    target_posi: new T.Vector3(0.5, TABLE_HEIGHT, 0.75),
                    color: 0xFF0000,
                    target_object: "circle",
                    scene: this.scene
                })
            ],
            [
                new Brick({ 
                    init_posi: new T.Vector3(0.6, TABLE_HEIGHT + 0.02, 0.5), 
                    init_angle: 0, 
                    target_posi: new T.Vector3(0.8, TABLE_HEIGHT, -0.5), 
                    color: 0xdddd88, 
                    target_object: "circle",
                    scene: this.scene
                })
            ], 
            [
                new Brick({
                    init_posi: new T.Vector3(0.8, TABLE_HEIGHT + 0.02, -0.75), 
                    init_angle: 0, 
                    target_posi: new T.Vector3(0.5, TABLE_HEIGHT, 0.5), 
                    color: 0xFF0000, 
                    target_object: "circle",
                    scene: this.scene
                })
            ]
        ]

    }

    finished() {
        if (this.round < this.rounds.length) {
            this.round++;
            this.pubRound();
        } else {
            alert('All tasks are completed');
        }
    }

    // pubTaskPrepare() {
    //     this.study.pubTaskPrepare();
    // }

    pubRound() {
        let that = this;
        this.study.removeBricks();
        this.study.bricks = [];
    
        this.rounds[this.round - 1].forEach((brick) => {
            this.study.bricks.push(brick);
        });

        this.study.pubTaskPrepare();
    }

    init() {
        this.round = 1
        this.pubRound();
        this.study.init();
        // this.pubTaskPrepare();
        // this.camera.position.set(2, 1.5, 0);
        // this.camera.lookAt(new T.Vector3(0, 1.5, 0));
    }

    update(ee_pose) {
        this.study.update(ee_pose);
    }
}