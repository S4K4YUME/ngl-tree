import {Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {Element} from '../../opengl/element';
import {Matrix} from '../../opengl/matrix';
import {OpenGL} from '../../opengl/opengl';
import {Shader} from "../../opengl/shader";
import { Observable } from "rxjs";
import {Visualizer} from '../../interfaces/visualizer';
import {Node} from '../../models/node';
import {Tab} from '../../models/tab';
import {Form} from '../../form/form';
import {FormFactory} from '../../form/form-factory';
import {OpenglDemoTree} from '../../visualizations/opengl-demo-tree';
import {WorkerManager} from '../../utils/worker-manager';
import {DrawType} from '../../enums/draw-type';
import {FormComponent} from '../form/form.component';
import {Draw} from '../../interfaces/draw';
import {InteractionHandler} from '../../utils/interaction-handler';
import {SelectBus} from '../../providers/select-bus';
import {AaQuadOptions} from '../../interfaces/aa-quad-options';
import {RotatedQuadOptions} from '../../interfaces/rotated-quad-options';
import {CircleOptions} from '../../interfaces/circle-options';
import {EllipsoidOptions} from '../../interfaces/ellipsoid-options';
import {RingSliceOptions} from '../../interfaces/ring-slice-options';

@Component({
    selector: 'app-window',
    templateUrl: './window.component.html',
})
export class WindowComponent implements OnInit {
    @ViewChild('canvas') private canvas: ElementRef;
    @Input('tree') private tree: Node;
    @Input('snackbar') private snackbar: any;
    @Input('visualizer') public visualizer: Visualizer;
    @Input('tab') public tab: Tab;

    @Output() private loading: EventEmitter<boolean> = new EventEmitter<boolean>();
    @Output() private redrawAll: EventEmitter<void> = new EventEmitter<void>();

    public form: Form|null;

    private context: CanvasRenderingContext2D;
    public tooltipActive: boolean = false;
    public tooltipLabel: string;
    public tooltipX: number;
    public tooltipY: number;
    private lastTooltipNode: Node;

    /** @author Roan Hofland */
    private errored: boolean = false;
    private lastError: string;

    private gl: OpenGL;

    private down: boolean = false;
    private lastX: number;
    private lastY: number;
    private readonly ZOOM_NORMALISATION = 40;
    private readonly ZOOM_FOCUS_FACTOR = 6;
    private lastSettings: object;

    private readonly ROTATION_NORMALISATION = 10;
    private readonly DEFAULT_DR = 1;
    private readonly DEFAULT_DT = 5;
    private readonly DEFAULT_DS = 0.1;

    private currentDraws: Draw[];
    private interactionHandler: InteractionHandler;

    constructor(private formFactory: FormFactory, private workerManager: WorkerManager, private selectBus: SelectBus) {
        this.interactionHandler = new InteractionHandler();

        this.selectBus.nodeSelected.subscribe((node: Node) => {
            if (this.tree.selectedNode != null) {
                this.tree.selectedNode.selected = false;
                this.tree.selectedNode = null;
            }

            this.tree.selectedNode = node;
            node.selected = true;

            this.redrawAllScenes();
            this.scaleToNode(node);
        });
    }

    ngOnInit() {
        this.tab.window = this; // create reference in order to enable tab-manager to communicate with component
        this.form = this.visualizer.getForm(this.formFactory);
        this.lastSettings = this.form != null ? this.form.getFormGroup().value : {};

        this.setHeight();
        this.startScene();

        if(!this.gl.isDedicatedGPU()) {
            this.snackbar.MaterialSnackbar.showSnackbar({
                message: "You are using integrated graphics, this could diminish your experience.",
                timeout: 1e8, // practically infinite
                actionHandler: () => { this.snackbar.MaterialSnackbar.cleanup_(); }, // close on click
                actionText: "CLOSE"
            });
        }
    }

    public change(value: object) {
        this.lastSettings = value;
        this.computeScene();
    }

    public keyEvent(event: KeyboardEvent): void {
        switch(event.key){
        case 'q':
        case 'Q':
            this.gl.rotate(-this.DEFAULT_DR);
            this.render();
            break;
        case 'e':
        case 'E':
            this.gl.rotate(this.DEFAULT_DR);
            this.render();
            break;
        case 'w':
        case 'W':
            this.gl.translate(0, this.DEFAULT_DT, this.canvas.nativeElement.clientWidth, this.canvas.nativeElement.clientHeight)
            this.render();
            break;
        case 's':
        case 'S':
            this.gl.translate(0, -this.DEFAULT_DT, this.canvas.nativeElement.clientWidth, this.canvas.nativeElement.clientHeight)
            this.render();
            break;
        case 'a':
        case 'A':
            this.gl.translate(this.DEFAULT_DT, 0, this.canvas.nativeElement.clientWidth, this.canvas.nativeElement.clientHeight)
            this.render();
            break;
        case 'd':
        case 'D':
            this.gl.translate(-this.DEFAULT_DT, 0, this.canvas.nativeElement.clientWidth, this.canvas.nativeElement.clientHeight)
            this.render();
            break;
        case 'r':
        case 'R':
            this.gl.scale(1 + this.DEFAULT_DS);
            this.render();
            break;
        case 'f':
        case 'F':
            this.gl.scale(1 - this.DEFAULT_DS);
            this.render();
            break;
        case 't':
        case 'T':
            this.gl.resetTransformations();
            this.render();
            break;
        }
    }

    //called when the mouse is pressed
    public mouseDown(): void {
        this.down = true;
    }

    //called when the mouse is realsed
    public mouseUp(): void {
        this.down = false;
    }

    //called when the mouse is clicked
    public onClick(event: MouseEvent): void {
        var coords = this.gl.transformPoint(event.layerX, event.layerY, this.canvas.nativeElement.clientWidth, this.canvas.nativeElement.clientHeight);

        if (this.tree == null) {
            return;
        }

        const node: Node = this.interactionHandler.determineElement(this.tree, this.currentDraws, coords);
        if (node !== null) {
            this.selectBus.selectNode(node);
        }
    }

    //called when the mouse moves
    public onDrag(event: MouseEvent): void {
        if(this.down){
            this.gl.translate((event.clientX - this.lastX), (event.clientY - this.lastY), this.canvas.nativeElement.clientWidth, this.canvas.nativeElement.clientHeight)
            this.render();
        } else if (this.tree != null) {
            var coords = this.gl.transformPoint(event.layerX, event.layerY, this.canvas.nativeElement.clientWidth, this.canvas.nativeElement.clientHeight);

            const node: Node = this.interactionHandler.determineElement(this.tree, this.currentDraws, coords);
            if (node != null) {
                if (this.lastTooltipNode !== node) {
                    this.tooltipLabel = node.label;
                    this.tooltipX = event.clientX;
                    this.tooltipY = event.clientY;
                    this.tooltipActive = true;
                    this.lastTooltipNode = node;
                }
            } else {
                this.tooltipActive = false;
                this.lastTooltipNode = null;
            }
        }

        this.lastX = event.clientX;
        this.lastY = event.clientY;
    }

    //called when the scroll wheel is scrolled
    public onScroll(event: WheelEvent): void {
        event.preventDefault();
        if(this.down){
            this.gl.rotate(event.deltaY / this.ROTATION_NORMALISATION);
        }else{
            this.gl.scale(Math.max(0.1, 1.0 - (event.deltaY / this.ZOOM_NORMALISATION)));
        }
        this.render();
    }

    public async startScene(): Promise<void> {
        this.init();
        await this.computeScene();
    }

    public destroyScene(): void {
        this.gl.releaseBuffers();
    }

    public redrawAllScenes(): void { // redraws all canvases through the AppComponent
        this.redrawAll.next();
    }

    /** @author Bart Wesselink */
    public scaleToNode(node: Node): void {
        const draw: Draw = this.interactionHandler.fetchDrawByNode(this.currentDraws, node);

        if (draw != null) {
            this.gl.resetTranslation();

            let x, y;

            if (draw.type === DrawType.DRAW_AA_QUAD || draw.type === DrawType.FILL_AA_QUAD || draw.type === DrawType.FILL_LINED_AA_QUAD) {
                const options: AaQuadOptions = draw.options as AaQuadOptions;

                // x,y are not centered, but in bottom-left corner
                x = options.x + options.width / 2;
                y = options.y + options.height / 2;
            } else {
                x = draw.options.x;
                y = draw.options.y;
            }

            enum Orientation {
                WIDTH,
                HEIGHT,
            }

            let size, width, height;
            let orientation: Orientation;

            const glWidth = this.gl.getWidth(this.canvas.nativeElement.clientWidth, this.canvas.nativeElement.clientHeight);
            const glHeight = this.gl.getHeight(this.canvas.nativeElement.clientWidth, this.canvas.nativeElement.clientHeight);

            switch (draw.type) {
                case DrawType.FILL_LINED_ROTATED_QUAD:
                case DrawType.DRAW_ROTATED_QUAD:
                case DrawType.FILL_ROTATED_QUAD:
                case DrawType.FILL_LINED_AA_QUAD:
                case DrawType.DRAW_AA_QUAD:
                case DrawType.FILL_AA_QUAD:
                    width = (draw.options as RotatedQuadOptions).width;
                    height = (draw.options as RotatedQuadOptions).height;

                    if (height > width) {
                        orientation = Orientation.HEIGHT;
                        size = height;
                    } else {
                        orientation = Orientation.WIDTH;
                        size = width;
                    }

                    break;
                case DrawType.FILL_LINED_CIRCLE:
                case DrawType.DRAW_CIRCLE:
                case DrawType.FILL_CIRCLE:
                case DrawType.FILL_LINED_CIRCLE_SLICE:
                case DrawType.DRAW_CIRCLE_SLICE:
                case DrawType.FILL_CIRCLE_SLICE:
                    size = (draw.options as CircleOptions).radius * 2;

                    if (glWidth > glHeight) {
                        orientation = Orientation.HEIGHT;
                    } else {
                        orientation = Orientation.WIDTH;
                    }

                    break;
                case DrawType.FILL_LINED_RING_SLICE:
                case DrawType.DRAW_RING_SLICE:
                case DrawType.FILL_RING_SLICE:
                    size = (draw.options as RingSliceOptions).far;

                    if (glWidth > glHeight) {
                        orientation = Orientation.HEIGHT;
                    } else {
                        orientation = Orientation.WIDTH;
                    }

                    break;
                case DrawType.FILL_LINED_ELLIPSOID:
                case DrawType.DRAW_ELLIPSOID:
                case DrawType.FILL_ELLIPSOID:
                    width = (draw.options as EllipsoidOptions).radx;
                    height = (draw.options as EllipsoidOptions).rady;

                    if (height > width) {
                        orientation = Orientation.HEIGHT;
                        size = height;
                    } else {
                        orientation = Orientation.WIDTH;
                        size = width;
                    }

                    break;
            }

            this.gl.glTranslate(-x, -y);

            let zoomFactor;

            if (orientation === Orientation.WIDTH) {
                zoomFactor = glWidth / (size * this.ZOOM_FOCUS_FACTOR);
            } else {
                zoomFactor = glHeight / (size * this.ZOOM_FOCUS_FACTOR);
            }

            this.gl.scale(zoomFactor);
        }
    }
    /** @end-author Bart Wesselink */

    //compute the visualisation
    public computeScene(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.gl.releaseBuffers();

            if (!this.visualizer) {
                return;
            }

            if (!this.tree && !(this.visualizer instanceof OpenglDemoTree)) { // only the demo visualizer can be rendered without data
                return; // there is no tree yet
            }

            this.startLoading();

            /** @author Bart Wesselink */
            this.workerManager.startWorker(this.gl, this.visualizer.draw,{ tree: this.tree, settings: this.lastSettings })
                .then((draws: Draw[]) => {
                    setTimeout(() => {
                        this.redraw();

                        this.stopLoading();
                    }, 100);

                    this.currentDraws = draws;

                    resolve();
                });
            /** @end-author Bart Wesselink */
        });
    }

    //fallback rendering for when some OpenGL error occurs
    private onError(error): void {
        this.errored = true;
        this.lastError = error;
        console.error(error);
        this.context = this.canvas.nativeElement.getContext('2d');
        this.context.clearRect(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height);

        this.context.font = "30px Verdana";
        this.context.fillStyle = "red";
        this.context.fillText("An internal OpenGL error occurred: " + error, 10, this.canvas.nativeElement.height / 2);
    }

    //draw OpenGL stuff
    public render(): void {
        this.gl.render();
    }

    //initialise OpenGL
    private init(): void {
        var gl: WebGLRenderingContext = this.canvas.nativeElement.getContext('webgl', {preserveDrawingBuffer: true});

        if(!gl){
            this.onError("No WebGL present");
            return;
        }

        this.gl = new OpenGL(gl);

        try{
            //a bit redundant right now, but useful if we ever want to implement more shaders
            var shader: Shader = this.gl.initShaders();
            this.gl.useShader(shader);
        }catch(error){
            this.onError((<Error>error).message);
        }
    }

    //redraw the canvas
    private redraw(): void {
        if(this.errored){
            this.onError(this.lastError);
        }else{
            this.render();
        }
    }
    /** @end-author Roan Hofland */
    /** @author Bart Wesselink */
    public setHeight(): void {
        // fix to set correct canvas size
        setTimeout(() => {
            this.canvas.nativeElement.width = this.canvas.nativeElement.scrollWidth;
            this.canvas.nativeElement.height = this.canvas.nativeElement.scrollHeight;

            this.gl.resize(this.canvas.nativeElement.width, this.canvas.nativeElement.height);
            this.redraw();
        });
    }

    private startLoading() {
        this.loading.emit(true);
    }

    private stopLoading() {
        this.loading.emit(false);
    }
    /** @end-author Bart Wesselink */
}
