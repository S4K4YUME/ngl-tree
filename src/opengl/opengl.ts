/** @author Roan Hofland */
import {Shader} from "./shader";
import {Element} from "./element";
import {Matrix} from "./matrix";

export class OpenGL{
    private gl: WebGLRenderingContext;
    private shader: Shader;
    private projectionMatrix;
    private arrays: Element[] = [];
    private readonly WIDTH = 1600;
    private readonly HEIGHT = 900;
    
    constructor(gl: WebGLRenderingContext){
        this.gl = gl;
        
        //set the canvas background color to 100% transparent black
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        
        this.projectionMatrix = Matrix.createMatrix();
        
        //note that we force a 16:9 effective viewport later on so this never changes
        Matrix.perspective(this.projectionMatrix,
                           (45 * Math.PI) / 180,                                     //fov, 45 degrees
                           this.gl.canvas.clientWidth / this.gl.canvas.clientHeight, //aspect ratio
                           1,                                                        //z-axis near
                           -1);                                                      //z-axis far
    }
    
    //resizes the viewport to the optimal size for the new canvas size
    public resize(width: number, height: number): void {
        //maintain the viewport aspect ratio at 16:9 and center the viewport as a 16:9 rectangle in the center of the actual canvas making sure to
        //position the viewport in such a way that it covers the entire canvas
        //by forcing a 16:9 viewport we can make sure that even when the canvas is resized our buffers remain correct so that 
        //the visualisation does not distort. Theoretically we could also recompute all the buffers and map to a new coordinate space.
        if((width / this.WIDTH) * this.HEIGHT > height){
            this.gl.viewport(0, (height - ((width / this.WIDTH) * this.HEIGHT)) / 2, width, (width / this.WIDTH) * this.HEIGHT);
        }else{
            this.gl.viewport((width - ((height / this.HEIGHT) * this.WIDTH)) / 2, 0, (height / this.HEIGHT) * this.WIDTH, height);
        }
    }
    
    //render the OpenGL scene
    public render(){
        this.clear();
        
        //the model view matrix will later be used for user interaction
        var modelviewMatrix = Matrix.createMatrix();
        
        this.gl.useProgram(this.shader.shader);
        this.gl.uniformMatrix4fv(this.gl.getUniformLocation(this.shader.shader, "projectionMatrix"), false, this.projectionMatrix);
        this.gl.uniformMatrix4fv(this.gl.getUniformLocation(this.shader.shader, "modelviewMatrix"), false, modelviewMatrix);
        
        this.drawBuffers();
    }
    
    //sets the shader to use
    public useShader(shader: Shader){
        this.shader = shader;
    }
    
    //releases all the OpenGL buffers
    public releaseBuffers(): void {
        while(this.arrays.length > 0){
            var elem = this.arrays.pop();
            this.gl.deleteBuffer(elem.color);
            this.gl.deleteBuffer(elem.pos);
        }
    }
    
    //draw an axis aligned quad
    public drawAAQuad(x: number, y: number, width: number, height: number, color: number[]): void {
        //scale to coordinate space
        x /= (this.WIDTH) / 2;
        y /= (this.HEIGHT) / 2;
        width /= (this.WIDTH) / 2;
        height /= (this.HEIGHT) / 2;
        
        this.drawQuadImpl(x + width, y + height,
                          x,         y + height,
                          x + width, y,
                          x,         y,
                          color);
    }
        
    //draw quad implementation
    private drawQuadImpl(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, color: number[]){
        //position
        var positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        const pos = [x1,  y1, 
                     x2,  y2, 
                     x3,  y3, 
                     x4,  y4];
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(pos), this.gl.STATIC_DRAW);
      
        //color
        var colorBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
        const colors = [color[0], color[1], color[2], color[3],
                        color[0], color[1], color[2], color[3],
                        color[0], color[1], color[2], color[3],
                        color[0], color[1], color[2], color[3]];
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STATIC_DRAW);
        this.arrays.push({
            pos: positionBuffer,
            color: colorBuffer,
            mode: this.gl.TRIANGLE_STRIP,
            length: 4
        });
    }
    
    //clear the screen
    public clear(): void {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
    
    //draw all the OpenGL buffers
    public drawBuffers(){
        for(var i = 0; i < this.arrays.length; i++){
            var elem = this.arrays[i];
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, elem.pos);
            this.gl.vertexAttribPointer(this.shader.shaderAttribPosition, //attribute
                                   2,                                     //2D so two values per iteration: x, y
                                   this.gl.FLOAT,                         //data type is float32
                                   false,                                 //no normalisation
                                   0,                                     //stride = automatic
                                   0);                                    //skip
            this.gl.enableVertexAttribArray(this.shader.shaderAttribPosition);
            
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, elem.color);
            this.gl.vertexAttribPointer(this.shader.shaderAttribColor,    //attribute
                                   4,                                     //rgba so four values per iteration: r, g, b, a
                                   this.gl.FLOAT,                         //data type is float32
                                   false,                                 //no normalisation
                                   0,                                     //stride = automatic
                                   0);                                    //skip
            this.gl.enableVertexAttribArray(this.shader.shaderAttribColor);
            
            this.gl.drawArrays(elem.mode, 0, elem.length);
        }
    }
    
    //initialises the shaders
    public initShaders(): Shader {
        //really simple minimal vertex shader
        //we just pass the color on to the fragment shader and don't perform any transformations
        const vertexShaderSource = `
          attribute vec4 pos;
          attribute vec4 color;
        
          uniform mat4 modelviewMatrix;
          uniform mat4 projectionMatrix;
        
          varying lowp vec4 vcolor;
          
          void main() {
            gl_Position = modelviewMatrix * modelviewMatrix * pos;
            vcolor = color;
          }
        `;
      
        //really simple fragment shader that just assigns the color it gets from the vertex shader
        //without transforming it in any way.
        const fragmentShaderSource = `
          varying lowp vec4 vcolor;
        
          void main() {
            gl_FragColor = vcolor;
          }
        `;
        
        //just some generic shader loading
        var fragmentShader;
        var vertexShader;
        {
            const shader = this.gl.createShader(this.gl.VERTEX_SHADER);
            this.gl.shaderSource(shader, vertexShaderSource);
            this.gl.compileShader(shader);
            if(!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)){
                this.gl.deleteShader(shader);
                throw new Error("Vertex shader compilation failed");
            }else{
                vertexShader = shader;
            }
        }
        {
            const shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
            this.gl.shaderSource(shader, fragmentShaderSource);
            this.gl.compileShader(shader);
            if(!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)){
                this.gl.deleteShader(shader);
                throw new Error("Fragment shader compilation failed");
            }else{
                fragmentShader = shader;
            }
        }
        
        //create a program using our vertex and fragment shader and link it
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if(!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)){
            throw new Error("Shader link status wrong");
        }
        
        //Initialise the shader object for use
        return{
            shader: program,
            shaderAttribPosition: this.gl.getAttribLocation(program, "pos"),
            shaderAttribColor: this.gl.getAttribLocation(program, "color")
        }
    }
}
/** @end-author Roan Hofland */     