/** @author Roan Hofland */
#define color 0.43137254901960784313725490196078431372549019607843137254901960784313725490196078431372549019607843137254901960784313725490196078431372549019607843137254901960784313725490196078431372549019607843137255
#define ratio 1.7777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777777778

varying lowp vec2 vpos;

uniform lowp float dx;
uniform lowp float dy;
uniform lowp float rx;
uniform lowp float ry;

void main() {
	lowp float x = vpos.x * ratio;
	gl_FragColor = vec4(color, color, color, 0.15 - 100.0 * min(abs(mod(x * rx + vpos.y * ry - dx * ratio, 0.1) - 0.05), abs(mod(x * ry - vpos.y * rx + dy, 0.1) - 0.05)));
}
/** @end-author Roan Hofland */
