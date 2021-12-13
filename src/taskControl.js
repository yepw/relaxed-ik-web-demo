import PickAndPlaceStatic from "./tasks/PickAndPlaceStatic"
import { DrawingTask, circleCurve, rectCurve, SVGCurve } from "./tasks/drawing"
import * as T from 'three'
import Brick from './tasks/Brick'

export class TaskControl {
    constructor(options) {
        this.scene = options.scene
        this.tasks = {
            'pickplace': new PickAndPlaceStatic ({ scene: this.scene }),
            'drawing': new DrawingTask({ scene: this.scene })
        };
        this.curr_task_name = 'pickplace'
        this.curr_task = undefined;

        this.camera = options.camera;
        this.round = 0;

        // 2D array to support multiple bricks/targets in a round
        this.rounds = { 'pickplace': [
            [
                new Brick({
                    init_posi: new T.Vector3(0.8,  0.02, 0.2),
                    init_angle: 0,
                    target_posi: new T.Vector3(0.5, 0, 0.75),
                    color: 0xFF0000,
                    target_object: "circle",
                    scene: this.scene
                })
            ],
            [
                new Brick({ 
                    init_posi: new T.Vector3(0.6, 0.02, 0.5), 
                    init_angle: 0, 
                    target_posi: new T.Vector3(0.8, 0, -0.5), 
                    color: 0xdddd88, 
                    target_object: "circle",
                    scene: this.scene
                })
            ], 
            [
                new Brick({
                    init_posi: new T.Vector3(0.8, 0.02, -0.75), 
                    init_angle: 0, 
                    target_posi: new T.Vector3(0.5, 0, 0.5), 
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
        
    finishRound() {
        if (this.curr_round < this.rounds[this.curr_task_name].length) {
            this.curr_round ++;
        } else {
            // alert('All tasks are completed');
            this.curr_round = 0;
        }
        this.nextRound();
    }

    nextRound() {
        let task = this.curr_task;
        task.reset();
        switch (this.curr_task_name) {
            case 'drawing':
                task.targetCurve = this.rounds[this.curr_task_name][this.curr_round];
                break;
            case 'pickplace':
                task.rounds = [];
                this.rounds[this.curr_task_name][this.curr_round].forEach((brick) => {
                    task.bricks.push(brick);
                });
        }

        task.nextRound();
    }

    init() {
        this.curr_round = 0
        if (this.curr_task)
            this.curr_task.quit();
        this.curr_task = this.tasks[this.curr_task_name];
        this.curr_task.init();
        this.nextRound();
    }

    // this is called about every 5 ms
    update(ee_pose) {
        if (this.curr_task)
            this.curr_task.update(ee_pose);
    }
}