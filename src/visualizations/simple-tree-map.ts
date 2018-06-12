import {Visualizer} from '../interfaces/visualizer';
import {Bounds} from '../interfaces/bounds';
import {Node} from '../models/node';
import {NodeTreeMap} from '../models/node-tree-map';
import {FormFactory} from '../form/form-factory';
import {VisualizerInput} from '../interfaces/visualizer-input';
import {Draw} from '../interfaces/draw';
import {Palette} from "../models/palette";

/** @author Nico Klaassen */

export class SimpleTreeMap implements Visualizer {
    public draw(input: VisualizerInput): Draw[] {
        const originalTree = input.tree;
        const draws: Draw[] = [];
        const settings: any = input.settings;
        const palette: Palette = input.palette;


        // define variables
        const defaultSize = 600;
        const lineColorSelected: number[] = [0, 0, 0, 1];
        const lineColorUnselected: number[] = [0.3, 0.3, 0.3, 1];
        let offset: number = settings.offset;
        let tree: NodeTreeMap = originalTree as NodeTreeMap;
        let rootBounds: Bounds = {
            left: -(defaultSize / 2),
            right: (defaultSize / 2),
            bottom: -(defaultSize / 2),
            top: (defaultSize / 2)
        };
        let drawOutlines: boolean = settings.outline;

        // define used enums
        enum Orientation {
            HORIZONTAL,
            VERTICAL
        }

        // define functions

        /**
         * Function which augments the tree data structure and adds in an orientation.
         *
         * @param {Node} tree Tree for which to calculate the orientation of the nodes for
         */
        const orientTreeNodes = (tree: NodeTreeMap): void => {
            // Toggle the orientation for direct children of the current node
            for (let child of tree.children) {
                if (tree.orientation === Orientation.HORIZONTAL) {
                    child.orientation = Orientation.VERTICAL;
                } else {
                    child.orientation = Orientation.HORIZONTAL;
                }
                orientTreeNodes(child);
            }
        };

        /** drawTree draw the tree-map recursively.
         *
         * @param {NodeTreeMap} tree The root of the subtree upon which we recurse
         * @param {Bounds} bounds The bounding-box indicating where we should draw the current root
         * @param {boolean} internalNode Whether we are recursing on internal nodes, or on the root of the initial input tree
         * @param {number[]} color The color with which we should draw our current bounding-box based rectangle
         * @param {boolean} selected Whether one of its parent was selected
         */
        const drawTree = (tree: NodeTreeMap, bounds: Bounds, internalNode: boolean, selected: boolean = false): void => {
            let doneSize = 0; // How many subtree-nodes are already taking up space within the bounds.

            let color;
            let lineColor;

            if (tree.selected === true || selected) {
                selected = true;
                color = palette.gradientColorMapSelected[tree.maxDepth][tree.depth];
                lineColor = lineColorSelected;
            } else {
                color = palette.gradientColorMap[tree.maxDepth][tree.depth];
                lineColor = lineColorUnselected;
            }

            let width = Math.abs(bounds.right - bounds.left);
            let height = Math.abs(bounds.top - bounds.bottom);

            let relativeOffset;
            let freeSpace;

            if (tree.orientation === Orientation.HORIZONTAL) {
                relativeOffset = Math.min(tree.width / 100 * offset / (tree.children.length + 1), tree.height / 100 * offset / (tree.children.length + 1));
                freeSpace = tree.width - (tree.children.length + 1) * relativeOffset;
            } else {
                relativeOffset = Math.min(width / 100 * offset / (tree.children.length + 1), tree.height / 100 * offset / (tree.children.length + 1));
                freeSpace = tree.height - (tree.children.length + 1) * relativeOffset;
            }

            // Draw the bounds of the current node
            if (drawOutlines) {
                draws.push({
                    type: 6 /** FillLinedAAQuad **/,
                    identifier: tree.identifier,
                    options: {
                        x: bounds.left,
                        y: bounds.bottom,
                        width: width,
                        height: height,
                        fillColor: color,
                        lineColor: lineColor
                    }
                });
            } else {
                draws.push({
                    type: 4 /** FillAAQuad **/,
                    identifier: tree.identifier,
                    options: {x: bounds.left, y: bounds.bottom, width: width, height: height, color: color}
                });
            }

            // Compute color and size per child, recurse on each child with the new - and nested - bounds.
            for (let i = 0; i< tree.children.length; i++) {
                const childNode = tree.children[i];
                let childBounds;
                if (tree.orientation === Orientation.HORIZONTAL) {
                    childBounds = {
                        left: (i == 0) ?
                            bounds.left + relativeOffset :
                            bounds.left + relativeOffset * (i + 1) + (freeSpace * doneSize / (tree.subTreeSize - 1)),
                        right: (i == tree.children.length - 1) ?
                            bounds.left + relativeOffset * (i + 1) + freeSpace :
                            bounds.left + relativeOffset * (i + 1) + (freeSpace * (doneSize + childNode.subTreeSize) / (tree.subTreeSize - 1)),
                        bottom: bounds.bottom + relativeOffset,
                        top: bounds.top - relativeOffset
                    };
                } else {
                    childBounds = {
                        left: bounds.left + relativeOffset,
                        right: bounds.right - relativeOffset,
                        bottom: (i == tree.children.length - 1) ?
                            bounds.top - relativeOffset * (i + 1) - freeSpace :
                            bounds.top - relativeOffset * (i + 1) - (freeSpace * (doneSize + childNode.subTreeSize) / (tree.subTreeSize - 1)),
                        top: (i == 0) ?
                            bounds.top - relativeOffset :
                            bounds.top - relativeOffset * (i + 1) - (freeSpace * doneSize / (tree.subTreeSize - 1))
                    };
                }
                childNode.width = Math.abs(childBounds.right - childBounds.left);
                childNode.height = Math.abs(childBounds.top - childBounds.bottom);
                doneSize = doneSize + childNode.subTreeSize; // Add the # of nodes in the subtree rooted at the childnode to doneSize.

                drawTree(childNode, childBounds, true, selected);
            }
        };

        // Initialize orientation only when it's not yet defined
        if (!tree.orientation) {
            tree.orientation = Orientation.HORIZONTAL;
            orientTreeNodes(tree);
        }
        // Give the default width and height
        tree.width = defaultSize;
        tree.height = defaultSize;

        drawTree(tree, rootBounds, false);

        return draws;
    }

    public getForm(formFactory: FormFactory) {
        return formFactory.createFormBuilder()
            .addToggleField('outline', true, {label: 'Draw outlines'})
            .addSliderField('offset', 0, {label: 'Offset', min: 0, max: 25})
            .getForm();
    }

    public getName(): string {
        return 'Simple Tree Map';
    }

    public getThumbnailImage(): string | null {
        return '/assets/images/visualization-simple-tree-map.png';
    }
}

/** @end-author Nico Klaassen */
