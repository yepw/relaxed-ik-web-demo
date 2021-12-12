import { Brick, PickAndPlaceBricksTabletop } from "./tasks/pickAndPlace"
import { DrawingTask, circleCurve, rectCurve, SVGCurve } from "./tasks/drawing"
import * as T from 'three'

export class TaskControl {
    constructor(options) {
        this.scene = options.scene
        this.task = {
            'pickplace': new PickAndPlaceBricksTabletop({ scene: this.scene }),
            'drawing': new DrawingTask({ scene: this.scene })
        };
        this.curr_task = 'pickplace'

        this.camera = options.camera;
        this.round = 0;

        const TABLE_HEIGHT = 0.92;

        // 2D array to support multiple bricks/targets in a round
        this.rounds = { 'pickplace': [
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
        ],
        'drawing': [
            new rectCurve(),
            new circleCurve(),
            new SVGCurve('hri_curve.svg')
            // new SVGCurve('ros_curve.svg'),
            // new SVGCurve('lab_curve.svg')
        ]};
    }
        
    finished() {
        if (this.curr_round < this.rounds[this.curr_task].length) {
            this.curr_round++;
            this.pubRound();
        } else {
            // alert('All tasks are completed');
            this.curr_round = 1;
            this.pubRound();
        }
    }

    pubRound() {
        let that = this;
        let task = this.task[this.curr_task];
        switch (this.curr_task) {
            case 'drawing':
                task.removeTargetCurve();
                task.targetCurve = this.rounds[this.curr_task][this.curr_round - 1];
                break;
            case 'pickplace':
                task.removeBricks();
                task.bricks = [];
                this.rounds[this.curr_task][this.curr_round - 1].forEach((brick) => {
                    task.bricks.push(brick);
                });
        }

        task.pubTaskPrepare();
    }

    init() {
        this.curr_round = 1
        if (this.prev_task)
            this.task[this.prev_task].quit();
        this.prev_task = this.curr_task;
        this.task[this.curr_task].init();
        this.pubRound();
    }

    // this is called about every 5 ms
    update(ee_pose) {
        this.task[this.curr_task].update(ee_pose);
    }
}